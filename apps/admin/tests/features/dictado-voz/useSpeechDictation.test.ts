import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechDictation } from '@/features/dictado-voz/useSpeechDictation';
import { transcribirLocal } from '@/infrastructure/whisper/transcribirLocal';

vi.mock('@/infrastructure/whisper/transcribirLocal', () => ({ transcribirLocal: vi.fn() }));

const detenerPista = vi.fn();
const permiso = vi.fn();
const stream = { getTracks: () => [{ stop: detenerPista }] };

class GrabadoraFalsa {
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable?: ({ data }: { data: Blob }) => void;
  onstop?: () => void;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['audio sintético']) });
      this.onstop?.();
    });
  }
}

describe('dictado clínico', () => {
  beforeEach(() => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('MediaRecorder', GrabadoraFalsa);
    vi.stubGlobal('OfflineAudioContext', class {});
    vi.stubGlobal('Worker', class {});
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: permiso }, gpu: {} });
    permiso.mockResolvedValue(stream);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('procesa el audio solo al detener y devuelve una vista previa descartable', async () => {
    vi.mocked(transcribirLocal).mockResolvedValue('Texto sintético');
    const { result } = renderHook(useSpeechDictation);
    expect(permiso).not.toHaveBeenCalled();
    await act(() => result.current.iniciar());
    expect(result.current.estado.tipo).toBe('grabando');
    expect(transcribirLocal).not.toHaveBeenCalled();

    await act(async () => result.current.detener());
    expect(detenerPista).toHaveBeenCalledTimes(1);
    expect(transcribirLocal).toHaveBeenCalledWith(expect.any(Blob), expect.any(AbortSignal), expect.any(Function));
    expect(result.current.estado).toEqual({ tipo: 'revision', texto: 'Texto sintético' });
    act(() => result.current.descartar());
    expect(result.current.estado.tipo).toBe('inactivo');
  });

  it('sigue grabando después de 30 segundos y solo se detiene al llegar a cinco minutos', async () => {
    vi.useFakeTimers();
    vi.mocked(transcribirLocal).mockResolvedValue('Texto sintético');
    const { result } = renderHook(useSpeechDictation);
    await act(() => result.current.iniciar());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.estado.tipo).toBe('grabando');
    await act(() => vi.advanceTimersByTimeAsync(269_999));
    expect(result.current.estado.tipo).toBe('grabando');
    expect(transcribirLocal).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(detenerPista).toHaveBeenCalledTimes(1);
    expect(result.current.estado.tipo).toBe('revision');
  });

  it('aborta la inferencia al cancelar e ignora resultados tardíos', async () => {
    let completar: (text: string) => void = () => {};
    vi.mocked(transcribirLocal).mockImplementation(() => new Promise((resolve) => { completar = resolve; }));
    const { result } = renderHook(useSpeechDictation);
    await act(() => result.current.iniciar());
    await act(async () => result.current.detener());
    const [, signal] = vi.mocked(transcribirLocal).mock.calls[0];
    act(() => result.current.descartar());
    expect(signal.aborted).toBe(true);
    await act(async () => completar('No debe insertarse'));
    expect(result.current.estado.tipo).toBe('inactivo');
  });

  it('cierra el micrófono si se concede permiso después de salir del historial', async () => {
    let conceder: (value: typeof stream) => void = () => {};
    permiso.mockReturnValue(new Promise((resolve) => { conceder = resolve; }));
    const { result, unmount } = renderHook(useSpeechDictation);
    act(() => { void result.current.iniciar(); });
    expect(result.current.estado.tipo).toBe('permiso');
    unmount();
    await act(async () => conceder(stream));
    expect(detenerPista).toHaveBeenCalledTimes(1);
    expect(transcribirLocal).not.toHaveBeenCalled();
  });

  it('permite seguir escribiendo si se deniega el micrófono', async () => {
    permiso.mockRejectedValue(new DOMException('Denegado', 'NotAllowedError'));
    const { result } = renderHook(useSpeechDictation);
    await act(() => result.current.iniciar());
    expect(result.current.estado).toMatchObject({ tipo: 'error', mensaje: expect.stringContaining('escribir') });
    expect(result.current.activo).toBe(false);
  });
});
