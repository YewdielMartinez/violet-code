import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  XLSX_MIME,
  columnLetter,
  crc32,
  downloadBlob,
  safeSheetName,
  sanitizeText,
  toCsv,
  toCsvBlob,
  toXlsx,
  toXlsxBytes,
  zipStore,
  type ExportColumn,
} from '@/shared/export';

interface Row {
  nombre: string;
  total: number | null;
}

const COLUMNS: ExportColumn<Row>[] = [
  { key: 'nombre', header: 'Área', value: (r) => r.nombre },
  { key: 'total', header: 'Atenciones', value: (r) => r.total },
];

/** Lee las entradas de un ZIP STORE recorriendo el directorio central y verifica sus CRC. */
function readZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(pos, true)).toBe(0x02014b50);
    const method = view.getUint16(pos + 10, true);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const local = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    expect(method).toBe(0);
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, decoder.decode(data));
    pos += 46 + nameLen;
  }
  return files;
}

describe('sanitizeText', () => {
  it.each(['=1+1', '+SUMA(A1)', '-2', '@cmd', '\tx', '\rx'])('antepone apóstrofo a %j', (text) => {
    expect(sanitizeText(text)).toBe(`'${text}`);
  });

  it('deja intacto el texto normal', () => {
    expect(sanitizeText('Psicología')).toBe('Psicología');
    expect(sanitizeText('a=b')).toBe('a=b');
    expect(sanitizeText('')).toBe('');
  });
});

describe('toCsv', () => {
  it('inicia con BOM UTF-8, usa CRLF y termina con salto', () => {
    const csv = toCsv([{ nombre: 'Jurídico', total: 4 }], COLUMNS);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿Área,Atenciones\r\nJurídico,4\r\n');
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('cita según RFC 4180: comas, comillas dobles y saltos de línea', () => {
    const csv = toCsv(
      [
        { nombre: 'Uno, dos', total: 1 },
        { nombre: 'Dijo "hola"', total: 2 },
        { nombre: 'Línea\nnueva', total: 3 },
      ],
      COLUMNS,
    );
    expect(csv).toContain('"Uno, dos",1\r\n');
    expect(csv).toContain('"Dijo ""hola""",2\r\n');
    expect(csv).toContain('"Línea\nnueva",3\r\n');
  });

  it('sanitiza fórmulas en texto pero conserva los números (también negativos)', () => {
    const csv = toCsv(
      [
        { nombre: '=HYPERLINK("http://x")', total: -5 },
        { nombre: '@SUM(A1)', total: 7 },
        { nombre: '-cmd', total: 0 },
      ],
      COLUMNS,
    );
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")",-5\r\n`);
    expect(csv).toContain(`'@SUM(A1),7\r\n`);
    expect(csv).toContain(`'-cmd,0\r\n`);
  });

  it('escribe vacío para null y para números no finitos', () => {
    const csv = toCsv(
      [
        { nombre: 'A', total: null },
        { nombre: 'B', total: Number.NaN },
      ],
      COLUMNS,
    );
    expect(csv).toContain('A,\r\n');
    expect(csv).toContain('B,\r\n');
  });

  it('sanitiza también los encabezados', () => {
    const csv = toCsv([], [{ key: 'x', header: '=evil', value: () => 1 }]);
    expect(csv).toBe("﻿'=evil\r\n");
  });

  it('el Blob lleva el tipo text/csv y conserva el BOM', async () => {
    const blob = toCsvBlob([{ nombre: 'Á', total: 1 }], COLUMNS);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe('zipStore / crc32', () => {
  it('calcula el CRC-32 estándar', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('empaqueta y se puede leer de vuelta', () => {
    const enc = new TextEncoder();
    const zip = zipStore([
      { name: 'a.txt', data: enc.encode('hola') },
      { name: 'dir/ñ.txt', data: enc.encode('acentos áéí') },
    ]);
    const files = readZip(zip);
    expect(files.get('a.txt')).toBe('hola');
    expect(files.get('dir/ñ.txt')).toBe('acentos áéí');
  });
});

describe('toXlsx', () => {
  const rows: Row[] = [
    { nombre: 'Psicología', total: 12 },
    { nombre: '=cmd|"/c calc"!A1', total: 3 },
    { nombre: 'A & B <x>', total: null },
  ];

  it('es un ZIP con la estructura OOXML mínima', () => {
    const files = readZip(toXlsxBytes(rows, COLUMNS, 'Informe'));
    expect([...files.keys()].sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
      ].sort(),
    );
    expect(files.get('[Content_Types].xml')).toContain('spreadsheetml.worksheet+xml');
    expect(files.get('_rels/.rels')).toContain('xl/workbook.xml');
    expect(files.get('xl/_rels/workbook.xml.rels')).toContain('worksheets/sheet1.xml');
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Informe" sheetId="1" r:id="rId1"/>');
    expect(files.get('xl/styles.xml')).toContain('<b/>');
  });

  it('escribe encabezados en negritas, texto en línea y números numéricos', () => {
    const sheet = readZip(toXlsxBytes(rows, COLUMNS)).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Área</t></is></c>');
    expect(sheet).toContain('<c r="B1" s="1" t="inlineStr">');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Psicología</t></is></c>');
    expect(sheet).toContain('<c r="B2"><v>12</v></c>');
    expect(sheet).toContain('<c r="B3"><v>3</v></c>');
    // null: sin celda.
    expect(sheet).not.toContain('r="B4"');
  });

  it('sanitiza fórmulas como texto con apóstrofo y escapa XML', () => {
    const sheet = readZip(toXlsxBytes(rows, COLUMNS)).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).toContain(`<t xml:space="preserve">'=cmd|&quot;/c calc&quot;!A1</t>`);
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('A &amp; B &lt;x&gt;');
  });

  it('un número negativo sigue numérico y un texto con signo menos se marca como texto', () => {
    const sheet = readZip(
      toXlsxBytes(
        [
          { nombre: '-1', total: -4 },
          { nombre: '+9', total: 1 },
        ],
        COLUMNS,
      ),
    ).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).toContain(`<t xml:space="preserve">'-1</t>`);
    expect(sheet).toContain('<c r="B2"><v>-4</v></c>');
    expect(sheet).toContain(`<t xml:space="preserve">'+9</t>`);
  });

  it('quita caracteres de control no válidos en XML', () => {
    const sheet = readZip(toXlsxBytes([{ nombre: 'a\u0001b\u0008c', total: 1 }], COLUMNS)).get(
      'xl/worksheets/sheet1.xml',
    ) as string;
    expect(sheet).toContain('<t xml:space="preserve">abc</t>');
  });

  it('el Blob tiene el tipo MIME de xlsx y empieza con la firma ZIP', async () => {
    const blob = toXlsx(rows, COLUMNS, 'Informe');
    expect(blob.type).toBe(XLSX_MIME);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('funciona sin filas (solo encabezados)', () => {
    const sheet = readZip(toXlsxBytes([], COLUMNS)).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).toContain('<dimension ref="A1:B1"/>');
    expect(sheet).toContain('Atenciones');
  });
});

describe('utilidades de xlsx', () => {
  it('columnLetter', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('safeSheetName', () => {
    expect(safeSheetName('Informe: Marzo/2026?')).toBe('Informe  Marzo 2026');
    expect(safeSheetName('')).toBe('Hoja1');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
  });
});

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('crea una URL de objeto, hace clic en un enlace con el nombre y la libera', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('informe-2026-03.csv');
      expect(this.getAttribute('href')).toBe('blob:fake');
    });

    downloadBlob(new Blob(['x']), 'informe-2026-03.csv');

    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });
});
