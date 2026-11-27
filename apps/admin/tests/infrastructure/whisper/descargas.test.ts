import { afterEach, describe, expect, it, vi } from 'vitest';
import { observarDescargasWhisper } from '@/infrastructure/whisper/descargas';

const URL_ARCHIVO = 'https://example.com/onnx/encoder.onnx';
const NOMBRE = 'onnx/encoder.onnx';
const resolver = (url: URL) => url.href === URL_ARCHIVO ? NOMBRE : undefined;

afterEach(() => vi.restoreAllMocks());

describe('descargas de Whisper', () => {
  it('distingue una consulta de metadatos de la transferencia y contabiliza bytes reales', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(200);
    const informar = vi.fn();
    let origen!: ReadableStreamDefaultController<Uint8Array>;
    const contenido = new ReadableStream<Uint8Array>({ start: (controller) => { origen = controller; } });
    const fetchArchivo = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 206, headers: { 'content-range': 'bytes 0-0/6' } }))
      .mockResolvedValueOnce(new Response(contenido));
    const descargar = observarDescargasWhisper(fetchArchivo, resolver, informar);

    await descargar(URL_ARCHIVO, { headers: { Range: 'bytes=0-0' } });
    expect(informar).not.toHaveBeenCalled();
    const respuesta = await descargar(URL_ARCHIVO);
    expect(fetchArchivo).toHaveBeenLastCalledWith(URL_ARCHIVO, { cache: 'no-store' });
    expect(informar).toHaveBeenNthCalledWith(1, [{ nombre: NOMBRE, fase: 'conectando', total: 6, recibidos: 0 }]);
    expect(informar).toHaveBeenNthCalledWith(2, [{ nombre: NOMBRE, fase: 'descargando', total: 6, recibidos: 0 }]);
    const lector = respuesta.body!.getReader();
    origen.enqueue(new Uint8Array([1, 2]));
    expect((await lector.read()).value).toEqual(new Uint8Array([1, 2]));
    expect(informar).toHaveBeenLastCalledWith([{ nombre: NOMBRE, fase: 'descargando', total: 6, recibidos: 2 }]);
    origen.enqueue(new Uint8Array([3, 4, 5, 6]));
    origen.close();
    await lector.read();
    await lector.read();
    expect(informar).toHaveBeenLastCalledWith([{ nombre: NOMBRE, fase: 'listo', total: 6, recibidos: 6 }]);
  });

  it('no inventa un total para un archivo comprimido y conserva la respuesta', async () => {
    const informar = vi.fn();
    const fetchArchivo = vi.fn().mockResolvedValue(new Response('abcd', {
      headers: { 'content-length': '10', 'content-encoding': 'gzip' },
    }));
    const descargar = observarDescargasWhisper(fetchArchivo, resolver, informar);
    const respuesta = await descargar(URL_ARCHIVO);
    expect(informar).toHaveBeenLastCalledWith([{ nombre: NOMBRE, fase: 'descargando', total: null, recibidos: 0 }]);
    expect(await respuesta.text()).toBe('abcd');
    expect(informar).toHaveBeenLastCalledWith([{ nombre: NOMBRE, fase: 'listo', total: 4, recibidos: 4 }]);
  });

  it('ignora recursos ajenos y no marca una respuesta fallida como descargada', async () => {
    const informar = vi.fn();
    const descargar = observarDescargasWhisper(vi.fn().mockImplementation(async () => new Response(null, { status: 404 })), resolver, informar);
    await descargar('https://example.com/otro.txt');
    expect(informar).not.toHaveBeenCalled();
    expect((await descargar(URL_ARCHIVO)).status).toBe(404);
    expect(informar).toHaveBeenLastCalledWith([]);
  });
});
