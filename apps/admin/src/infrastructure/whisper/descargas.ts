import type { ArchivoWhisper } from './protocol';

type FetchArchivo = (input: string | URL, init?: RequestInit) => Promise<Response>;

const INTERVALO_PROGRESO_MS = 150;

export function observarDescargasWhisper(
  fetchArchivo: FetchArchivo,
  obtenerNombre: (url: URL) => string | undefined,
  informar: (archivos: ArchivoWhisper[]) => void,
): FetchArchivo {
  const archivos = new Map<string, ArchivoWhisper>();
  const tamanios = new Map<string, number>();
  const publicar = () => informar([...archivos.values()].map((archivo) => ({ ...archivo })));

  return async (input, init) => {
    const url = new URL(input, globalThis.location?.href);
    const nombre = obtenerNombre(url);
    if (!nombre || (init?.method ?? 'GET').toUpperCase() !== 'GET') return fetchArchivo(input, init);
    if (new Headers(init?.headers).has('range')) {
      const response = await fetchArchivo(input, init);
      const total = Number(response.headers.get('content-range')?.split('/')[1]);
      if (response.status === 206 && Number.isSafeInteger(total) && total > 0) tamanios.set(url.href, total);
      return response; // Consulta de metadatos, no es una descarga del archivo.
    }

    const archivo: ArchivoWhisper = {
      nombre, fase: 'conectando', recibidos: 0, total: tamanios.get(url.href) ?? null,
    };
    archivos.set(url.href, archivo);
    publicar();

    try {
      // Transformers ya consulta su Cache API antes de llegar aquí. Evitar una segunda caché
      // HTTP permite mostrar solo transferencias reales en este estado.
      const response = await fetchArchivo(input, { ...init, cache: 'no-store' });
      if (!response.ok || !response.body) {
        archivos.delete(url.href);
        publicar();
        return response;
      }
      if (archivo.total === null && !response.headers.get('content-encoding')) {
        const bytes = Number(response.headers.get('content-length'));
        if (Number.isSafeInteger(bytes) && bytes > 0) archivo.total = bytes;
      }
      archivo.fase = 'descargando';
      publicar();

      let ultimaPublicacion = performance.now();
      const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          archivo.recibidos += chunk.byteLength;
          if (archivo.total !== null && archivo.recibidos > archivo.total) archivo.total = null;
          const ahora = performance.now();
          if (ahora - ultimaPublicacion >= INTERVALO_PROGRESO_MS) {
            ultimaPublicacion = ahora;
            publicar();
          }
          controller.enqueue(chunk);
        },
        flush() {
          archivo.fase = 'listo';
          archivo.total = archivo.recibidos;
          publicar();
        },
      }));
      return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      archivos.delete(url.href);
      publicar();
      throw error;
    }
  };
}
