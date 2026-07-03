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

/** HH:MM de una fecha ISO (hora local, 24 h). */
export function horaCorta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Hora en formato 12 h con "a.m."/"p.m." (igual que la web: "11:21 p.m.").
 * Devuelve minúsculas; usá .toUpperCase() en el call site si querés "P.M.".
 */
export function hora12(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const sufijo = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/**
 * Duración entre dos instantes en formato MM:SS. Los minutos NO se acotan a 60
 * (un llamado de hace 8 h muestra "488:51", igual que la web). Si falta `hasta`
 * se usa el momento actual.
 */
export function duracion(desde?: string | null, hasta?: string | null): string {
  if (!desde) return '';
  const inicio = new Date(desde).getTime();
  const fin = hasta ? new Date(hasta).getTime() : Date.now();
  const totalSec = Math.max(0, Math.floor((fin - inicio) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
