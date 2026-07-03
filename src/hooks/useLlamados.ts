import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { inicioDiaOperativo } from '../lib/fecha';
import { Id, LLAMADO_ATENDIDO, LLAMADO_PENDIENTE, Llamado } from '../types/db';

export interface LlamadoHist extends Llamado {
  atendidoPor?: string | null; // nombre del mesero que atendió
}

export function useLlamados(zonas: string[], meseroId: Id) {
  const [activos, setActivos] = useState<Llamado[]>([]);
  const [historial, setHistorial] = useState<LlamadoHist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const zonasRef = useRef(zonas);
  zonasRef.current = zonas;

  const fetchActivos = useCallback(async () => {
    const z = zonasRef.current;
    if (!z.length) {
      setActivos([]);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: e } = await supabase
      .from('llamados')
      .select('*')
      .eq('estado', LLAMADO_PENDIENTE)
      .in('ubicacion', z)
      .order('created_at', { ascending: true })
      .returns<Llamado[]>();
    if (e) {
      // eslint-disable-next-line no-console
      console.error('[useLlamados] activos:', e.message);
      setError('No se pudieron cargar los llamados.');
    } else {
      setActivos(data ?? []);
    }
    setLoading(false);
  }, []);

  const fetchHistorial = useCallback(async () => {
    const z = zonasRef.current;
    if (!z.length) {
      setHistorial([]);
      return;
    }
    const { data } = await supabase
      .from('llamados')
      .select('*')
      .eq('estado', LLAMADO_ATENDIDO)
      .in('ubicacion', z)
      .gte('atendido_at', inicioDiaOperativo())
      .order('atendido_at', { ascending: false })
      .returns<Llamado[]>();

    const rows = data ?? [];
    // Resolver nombre del mesero que atendió (mesero_id -> nombre).
    const ids = Array.from(new Set(rows.map((r) => r.mesero_id).filter((v) => v != null))) as Id[];
    let nombrePorId: Record<string, string> = {};
    if (ids.length) {
      const { data: ms } = await supabase.from('meseros').select('id, nombre').in('id', ids);
      nombrePorId = Object.fromEntries(
        (ms ?? []).map((m: { id: Id; nombre: string }) => [String(m.id), m.nombre]),
      );
    }
    setHistorial(
      rows.map((r) => ({
        ...r,
        atendidoPor: r.mesero_id != null ? nombrePorId[String(r.mesero_id)] ?? null : null,
      })),
    );
  }, []);

  useEffect(() => {
    fetchActivos();
    fetchHistorial();
    const ch = supabase
      .channel('llamados-mesero')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamados' }, () => {
        fetchActivos();
        fetchHistorial();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchActivos, fetchHistorial, zonas.join('|')]);

  /** Marca un llamado como atendido (por el mesero actual). */
  const atender = useCallback(
    async (llamadoId: Id) => {
      setActivos((prev) => prev.filter((l) => l.id !== llamadoId));
      const { data, error: e } = await supabase
        .from('llamados')
        .update({ estado: LLAMADO_ATENDIDO, atendido_at: new Date().toISOString(), mesero_id: meseroId })
        .eq('id', llamadoId)
        .select('id');
      if (e) {
        setError(`No se pudo marcar como atendido: ${e.message}`);
        await fetchActivos();
      } else if ((data?.length ?? 0) === 0) {
        setError('La base rechazó el cambio (permisos RLS de UPDATE en "llamados").');
        await fetchActivos();
      } else {
        setError(null);
      }
      await fetchHistorial();
    },
    [meseroId, fetchActivos, fetchHistorial],
  );

  /** Deshace el "atendido": el llamado vuelve a estar activo. */
  const cancelarAtendido = useCallback(
    async (llamadoId: Id) => {
      setHistorial((prev) => prev.filter((l) => l.id !== llamadoId));
      const { error: e } = await supabase
        .from('llamados')
        .update({ estado: LLAMADO_PENDIENTE, atendido_at: null, mesero_id: null })
        .eq('id', llamadoId);
      if (e) {
        setError('No se pudo deshacer.');
        await fetchHistorial();
      }
      await fetchActivos();
    },
    [fetchActivos, fetchHistorial],
  );

  return { activos, historial, loading, error, atender, cancelarAtendido };
}
