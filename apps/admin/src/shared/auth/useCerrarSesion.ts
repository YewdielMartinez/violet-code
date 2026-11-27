import { useNavigate } from 'react-router-dom';
import { toast } from '@yewdiel21/motion-kit/react';
import { logout } from './session';

/** Cierra la sesión, avisa y lleva al login (misma lógica para el menú Opciones y la sección Cuenta de Configuración). */
export function useCerrarSesion() {
  const navigate = useNavigate();
  return async function cerrarSesion() {
    await logout();
    toast('Sesión cerrada', { tone: 'info' });
    navigate('/login', { replace: true });
  };
}
