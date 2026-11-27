import { sanitizeText, type ExportCell, type ExportColumn } from './types';
import { zipStore } from './zip';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const encoder = new TextEncoder();

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Descarta los caracteres de control que XML 1.0 no admite (todos salvo tabulador, salto de línea y retorno). */
function stripInvalidXmlChars(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    const invalid = (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0xfffe || code === 0xffff;
    if (!invalid) out += ch;
  }
  return out;
}

/** Escapa texto XML y descarta los caracteres de control que XML 1.0 no admite. */
function xmlText(text: string): string {
  return stripInvalidXmlChars(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → A, 25 → Z, 26 → AA… */
export function columnLetter(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/** Nombre de hoja válido para Excel: sin `[]:*?/\`, máximo 31 caracteres, nunca vacío. */
export function safeSheetName(name: string): string {
  const clean = name
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31);
  return clean || 'Hoja1';
}

function cellXml(ref: string, cell: ExportCell, style = 0): string {
  const s = style ? ` s="${style}"` : '';
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? `<c r="${ref}"${s}><v>${cell}</v></c>` : '';
  }
  const text = xmlText(sanitizeText(String(cell)));
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function columnWidth(header: string, values: readonly ExportCell[]): number {
  let max = header.length;
  for (const v of values) max = Math.max(max, v === null || v === undefined ? 0 : String(v).length);
  return Math.min(60, Math.max(8, max + 3));
}

function sheetXml<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const matrix = rows.map((row) => columns.map((c) => c.value(row)));
  const cols = columns
    .map((c, i) => {
      const width = columnWidth(
        c.header,
        matrix.map((r) => r[i]),
      );
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');
  const header = `<row r="1">${columns.map((c, i) => cellXml(`${columnLetter(i)}1`, c.header, 1)).join('')}</row>`;
  const body = matrix
    .map(
      (r, ri) =>
        `<row r="${ri + 2}">${r.map((cell, ci) => cellXml(`${columnLetter(ci)}${ri + 2}`, cell)).join('')}</row>`,
    )
    .join('');
  const lastRef = `${columnLetter(Math.max(columns.length - 1, 0))}${matrix.length + 1}`;
  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}"><dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${header}${body}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS =
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`;

/** Estilo 0: normal. Estilo 1: encabezado en negritas. */
const STYLES =
  `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function workbookXml(sheetName: string): string {
  return (
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="${xmlText(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

/** Bytes de un .xlsx real (OOXML mínimo en un ZIP STORE): texto como cadenas en línea, números como numéricos. */
export function toXlsxBytes<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
  sheetName = 'Hoja1',
): Uint8Array<ArrayBuffer> {
  const file = (name: string, xml: string) => ({ name, data: encoder.encode(xml) });
  return zipStore([
    file('[Content_Types].xml', CONTENT_TYPES),
    file('_rels/.rels', ROOT_RELS),
    file('xl/workbook.xml', workbookXml(sheetName)),
    file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS),
    file('xl/styles.xml', STYLES),
    file('xl/worksheets/sheet1.xml', sheetXml(rows, columns)),
  ]);
}

export function toXlsx<T>(rows: readonly T[], columns: readonly ExportColumn<T>[], sheetName = 'Hoja1'): Blob {
  return new Blob([toXlsxBytes(rows, columns, sheetName)], { type: XLSX_MIME });
}
