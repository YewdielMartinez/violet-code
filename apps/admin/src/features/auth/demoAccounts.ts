/**
 * Cuentas SINTÉTICAS sembradas en `supabase/seed.sql` solo para la demostración del hackathon.
 * Nunca usar en un despliegue real: la contraseña es pública y compartida por todos los roles.
 *
 * El acceso rápido del login solo aparece si `VITE_DEMO_LOGIN=true` o en desarrollo (`import.meta.env.DEV`).
 */

export interface DemoAccount {
  id: string;
  /** Nombre del rol tal como se muestra en el chip. */
  role: string;
  email: string;
}

export const DEMO_PASSWORD = 'Demo1234!';

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { id: 'titular', role: 'Titular', email: 'titular@demo.violetcode.local' },
  { id: 'subdireccion', role: 'Subdirección', email: 'subdireccion@demo.violetcode.local' },
  { id: 'trabajo-social', role: 'Trabajo Social', email: 'trabajo.social@demo.violetcode.local' },
  { id: 'psicologia', role: 'Psicología', email: 'psicologia@demo.violetcode.local' },
  { id: 'juridico', role: 'Jurídico', email: 'juridico@demo.violetcode.local' },
  { id: 'recepcion', role: 'Recepción', email: 'recepcion@demo.violetcode.local' },
  { id: 'umeca', role: 'UMECA', email: 'umeca@demo.violetcode.local' },
];

/** Se evalúa en cada render (no al cargar el módulo) para poder probarlo y apagarlo por entorno. */
export function isDemoLoginEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === 'true';
}
