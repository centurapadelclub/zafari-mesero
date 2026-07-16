/**
 * Tipos de las tablas de Supabase (esquema REAL del proyecto).
 *
 * Relación mesero → zonas → llamados/pedidos:
 *   meseros 1—* asignaciones *—1 zonas        (asignaciones.zona_id -> zonas.id)
 *   zonas.nombre  ==  llamados.ubicacion / pedidos.ubicacion   ✔ confirmado
 *   (ej. 'Cancha 1', 'Mesa 25', 'BYT Studio' — mismo texto exacto)
 */

export type Id = string | number;

// ---- Estados por tabla (valores reales confirmados) ----
// llamados: flujo binario
export const LLAMADO_PENDIENTE = 'pendiente';
export const LLAMADO_ATENDIDO = 'atendido';

// pedidos: flujo de 3 estados
export const PEDIDO_PENDIENTE = 'pendiente';
export const PEDIDO_EN_PREPARACION = 'en_preparacion';
export const PEDIDO_ENTREGADO = 'entregado';

/**
 * Estados de pedido que el panel considera "activos" (aún no entregados) y por
 * lo tanto muestra al mesero. Cambiá esto si querés que el panel muestre solo
 * 'pendiente'.
 */
export const PEDIDO_ESTADOS_ACTIVOS = [PEDIDO_PENDIENTE, PEDIDO_EN_PREPARACION];

/** Estado al que pasa un pedido cuando el mesero toca "Atendido". */
export const PEDIDO_ESTADO_AL_ATENDER = PEDIDO_ENTREGADO;

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

/** Tabla: llamados (mesero_id se agrega con la migración SQL del README) */
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
  mesero_id?: Id | null;
}

/** Tabla: pedidos (atendido_at y mesero_id se agregan con la migración SQL) */
export interface Pedido {
  id: Id;
  numero?: string | number | null; // "número de pedido" si la tabla lo tiene; si no, usamos id
  ubicacion: string;
  estado: string;
  nombre_cliente?: string | null;
  telefono_cliente?: string | null;
  total?: number | null;
  created_at: string;
  atendido_at?: string | null;
  mesero_id?: Id | null;
}

/**
 * Detalle de un pedido (esquema real):
 *   pedido_items: id, pedido_id, nombre_producto, cantidad, precio_unitario, subtotal
 *   pedido_item_modificadores: pedido_item_id, nombre_modificador, nombre_opcion, precio_extra
 */
export const PEDIDO_ITEMS_TABLE = 'pedido_items';
export const PEDIDO_ITEM_MODIFICADORES_TABLE = 'pedido_item_modificadores';

export interface PedidoItemModificador {
  nombre_modificador?: string | null;
  nombre_opcion: string;
  precio_extra?: number | null;
}

export interface PedidoItem {
  id?: Id;
  pedido_id: Id;
  nombre: string; // nombre_producto
  cantidad: number;
  precioUnitario?: number | null; // precio_unitario
  subtotal?: number | null;
  modificadores: PedidoItemModificador[];
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
  atendido_at?: string | null;
  mesero_id?: Id | null;
  atendidoPor?: string | null; // nombre del mesero que atendió (historial)
}

/** Rutas del stack raíz de navegación. */
export type RootStackParamList = {
  Tabs: { tab?: 'llamados' | 'pedidos'; openPedidoId?: Id } | undefined;
  Preferences: undefined;
  IncomingCall: { kind: FeedKind; id: Id; ubicacion: string; tipo?: string | null };
};
