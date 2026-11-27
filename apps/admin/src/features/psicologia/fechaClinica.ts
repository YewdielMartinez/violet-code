const FECHA_CLINICA = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mazatlan',
});

export function formatFechaClinica(iso: string) {
  return FECHA_CLINICA.format(new Date(iso));
}
