/** Formatea un monto como "$60.00" (2 decimales, separador de miles). */
export function money(n?: number | null): string {
  if (n == null) return '';
  return `$${Number(n).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
