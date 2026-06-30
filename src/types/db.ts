/**
 * Tipos de las tablas de Supabase (esquema REAL del proyecto).
 *
 * Relación mesero → zonas → llamados/pedidos:
 *   meseros 1—* asignaciones *—1 zonas        (asignaciones.zona_id -> zonas.id)
 *   zonas.nombre  ==  llamados.ubicacion / pedidos.ubicacion   ⚠️ (ver abajo)
 *
 * ⚠️ SUPOSICIÓN IMPORTANTE (no pude verificarla en vivo, ver README):
 *   Los `llamados` y `pedidos` NO tienen columna de zona; solo `ubicacion`.
 *   Asumo que `ubicacion` contiene el NOMBRE de la zona (zonas.nombre), así que
 *   el feed del mesero filtra por `ubicacion IN (nombres de sus zonas)`.
 *   Si `ubicacion` es más granular (ej. "Mesa 5") y la zona se deriva de otra
 *   forma, decime un par de valores reales y lo ajusto.
 */

// Valores del campo `estado`. ⚠️ Asumidos: confirmá los reales en tu BD.
export const ESTADO_PENDIENTE = 'pendiente';
export const ESTADO_ATENDIDO = 'atendido';

export type Id = string | number;

/** Tabla: meseros */
export interface Mesero {
  id: Id;
  nombre: string;
  pin: string;
  rol?: string | null;
  activo?: boolean | null;
}

/** Tabla: zonas */
export interface Zona {
  id: Id;
  nombre: string;
}

/** Tabla: asignaciones (mesero ↔ zona) */
export interface Asignacion {
  id: Id;
  zona_id: Id;
  mesero_id: Id;
}

/** Tabla: llamados */
export interface Llamado {
  id: Id;
  ubicacion: string;
  tipo?: string | null;
  estado: string;
  nombre_cliente?: string | null;
  apellido_cliente?: string | null;
  telefono_cliente?: string | null;
  created_at: string;
  atendido_at?: string | null;
}

/** Tabla: pedidos (ojo: NO tiene atendido_at ni mesero_id) */
export interface Pedido {
  id: Id;
  ubicacion: string;
  estado: string;
  nombre_cliente?: string | null;
  telefono_cliente?: string | null;
  total?: number | null;
  created_at: string;
}

/** Item unificado para mostrar llamados y pedidos en la misma lista. */
export type FeedKind = 'llamado' | 'pedido';

export interface FeedItem {
  kind: FeedKind;
  id: Id;
  ubicacion: string;
  estado: string;
  tipo?: string | null; // solo llamados
  cliente?: string | null; // nombre + apellido (lo que haya)
  telefono?: string | null;
  total?: number | null; // solo pedidos
  created_at: string;
  atendido_at?: string | null; // solo llamados (pedidos no lo tiene)
}
