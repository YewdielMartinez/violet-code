/** Escritor ZIP mínimo (método STORE, sin compresión): lo justo para empaquetar un .xlsx sin dependencias. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// Fecha/hora DOS fija (1980-01-01 00:00) para que el archivo sea determinista.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;
/** Bit 11: nombres de archivo en UTF-8. */
const FLAG_UTF8 = 0x0800;

const encoder = new TextEncoder();

export function zipStore(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const prepared = entries.map((entry) => ({
    name: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }));
  const localSize = prepared.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
  const centralSize = prepared.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let pos = 0;
  const offsets: number[] = [];

  for (const e of prepared) {
    offsets.push(pos);
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true); // versión necesaria
    view.setUint16(pos + 6, FLAG_UTF8, true);
    view.setUint16(pos + 8, 0, true); // método 0 = STORE
    view.setUint16(pos + 10, DOS_TIME, true);
    view.setUint16(pos + 12, DOS_DATE, true);
    view.setUint32(pos + 14, e.crc, true);
    view.setUint32(pos + 18, e.data.length, true);
    view.setUint32(pos + 22, e.data.length, true);
    view.setUint16(pos + 26, e.name.length, true);
    view.setUint16(pos + 28, 0, true);
    out.set(e.name, pos + 30);
    out.set(e.data, pos + 30 + e.name.length);
    pos += 30 + e.name.length + e.data.length;
  }

  const centralStart = pos;
  prepared.forEach((e, i) => {
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true); // versión que lo creó
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, FLAG_UTF8, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, DOS_TIME, true);
    view.setUint16(pos + 14, DOS_DATE, true);
    view.setUint32(pos + 16, e.crc, true);
    view.setUint32(pos + 20, e.data.length, true);
    view.setUint32(pos + 24, e.data.length, true);
    view.setUint16(pos + 28, e.name.length, true);
    // 30 extra, 32 comentario, 34 disco, 36 attrs internos, 38 attrs externos: todo 0.
    view.setUint32(pos + 42, offsets[i], true);
    out.set(e.name, pos + 46);
    pos += 46 + e.name.length;
  });

  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 8, prepared.length, true);
  view.setUint16(pos + 10, prepared.length, true);
  view.setUint32(pos + 12, pos - centralStart, true);
  view.setUint32(pos + 16, centralStart, true);
  return out;
}
