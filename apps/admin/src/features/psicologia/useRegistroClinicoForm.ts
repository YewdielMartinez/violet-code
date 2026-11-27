import { useRef, useState } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import { validarRegistroClinico, type ExpedienteClinico, type RegistroClinicoInput } from '@/domain/models/HistorialClinico';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { useGuardarRegistroClinico } from './api';

export function useRegistroClinicoForm(
  expediente: ExpedienteClinico,
  fichaId: string,
  empleadoId: string,
  isDirty: boolean,
) {
  const [error, setError] = useState('');
  const { mutateAsync, reset, isPending } = useGuardarRegistroClinico(fichaId, empleadoId);
  const enviando = useRef(false);
  const blocker = useUnsavedChangesGuard(isDirty || isPending);

  async function guardar(input: RegistroClinicoInput) {
    if (enviando.current) return false;
    const mensaje = validarRegistroClinico(expediente, input);
    setError(mensaje ?? '');
    if (mensaje) return false;
    enviando.current = true;
    try {
      await mutateAsync(input);
      toast(input.tipo === 'primera' ? 'Historial clínico guardado.' : 'Observación guardada.', { tone: 'success' });
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar el registro.';
      setError(message);
      toast(message, { tone: 'error' });
      return false;
    } finally {
      reset();
      enviando.current = false;
    }
  }

  return { guardar, error, isPending, blocker };
}
