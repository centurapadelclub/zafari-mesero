/**
 * "Día operativo" con reset a las 2:00 AM (mismo criterio que la web): un pedido
 * o llamado de la 1:30 AM cuenta como del día anterior; a partir de las 2:00 AM
 * empieza el día nuevo.
 */
const RESET_HORA = 2; // 02:00

/** Devuelve el inicio del día operativo actual (ISO). */
export function inicioDiaOperativo(now: Date = new Date()): string {
  const d = new Date(now);
  // Si todavía no son las 2 AM, el día operativo arrancó ayer a las 2 AM.
  if (d.getHours() < RESET_HORA) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(RESET_HORA, 0, 0, 0);
  return d.toISOString();
}

/** HH:MM de una fecha ISO (hora local). */
export function horaCorta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
