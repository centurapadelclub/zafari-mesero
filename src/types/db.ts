/**
 * Tipos de las tablas de Supabase usadas por la app del mesero.
 *
 * ⚠️ SUPOSICIONES DE ESQUEMA
 * Estos tipos reflejan una estructura razonable inferida del enunciado, pero NO
 * conozco el esquema real de tu base. Ajusta los nombres de columna aquí (y en
 * src/hooks/useFeed.ts / AuthContext) para que coincidan con tus tablas reales.
 * Todo el acceso a datos pasa por un punto central, así que cambiar un nombre
 * de columna se hace en un solo lugar.
 *
 * Convención asumida:
 *  - Estado pendiente:  estado = 'pendiente'
 *  - Estado atendido:   estado = 'atendido'
 *  - Zona del llamado/pedido en la columna `zona` (texto), que debe coincidir
 *    con alguna de las zonas asignadas al mesero en la tabla `asignaciones`.
 */

export type EstadoItem = 'pendiente' | 'atendido' | string;

/** Tabla: meseros */
export interface Mesero {
  id: string;
  nombre: string;
  pin: string; // PIN de 4 dígitos (idealmente hasheado en BD; ver nota de seguridad en README)
  activo?: boolean | null;
}

/** Tabla: asignaciones (relaciona un mesero con las zonas que atiende) */
export interface Asignacion {
  id: string;
  mesero_id: string;
  zona: string;
}

/** Tabla: llamados (un cliente llama al mesero desde una mesa) */
export interface Llamado {
  id: string;
  mesa: string | number;
  zona: string;
  estado: EstadoItem;
  created_at: string; // timestamp ISO
  atendido_at?: string | null;
  mesero_id?: string | null;
}

/** Tabla: pedidos */
export interface Pedido {
  id: string;
  mesa: string | number;
  zona: string;
  estado: EstadoItem;
  descripcion?: string | null;
  created_at: string;
  atendido_at?: string | null;
  mesero_id?: string | null;
}

/**
 * Item unificado para mostrar llamados y pedidos en la misma lista del panel.
 * `kind` permite distinguir de qué tabla viene cada fila.
 */
export type FeedKind = 'llamado' | 'pedido';

export interface FeedItem {
  kind: FeedKind;
  id: string;
  mesa: string | number;
  zona: string;
  estado: EstadoItem;
  descripcion?: string | null;
  created_at: string;
  atendido_at?: string | null;
}
