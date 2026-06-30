/**
 * Verificación de la base Supabase contra el esquema que espera la app.
 *
 * Corré esto desde una red que SÍ pueda alcanzar Supabase (tu compu):
 *   node --env-file=.env scripts/check-db.mjs
 *   # (o:  npm run check:db)
 *
 * Valida:
 *   1. Conexión + lectura con la anon/publishable key (y por ende RLS de SELECT).
 *   2. Que `llamados.ubicacion` / `pedidos.ubicacion` coincidan con `zonas.nombre`
 *      (la suposición central para filtrar el feed por zona).
 *   3. Qué valores reales tiene `estado` (para confirmar 'pendiente'/'atendido').
 *   4. Que Realtime conecte (SUBSCRIBED).
 *
 * NO modifica datos.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('✖ Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('  Corré:  node --env-file=.env scripts/check-db.mjs');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const uniq = (arr) => Array.from(new Set(arr.filter((v) => v != null)));
let problemas = 0;

async function head(label, fn) {
  process.stdout.write(`\n=== ${label} ===\n`);
  try {
    await fn();
  } catch (e) {
    problemas++;
    console.error('  ✖ Error:', e.message ?? e);
  }
}

await head('zonas', async () => {
  const { data, error } = await supabase.from('zonas').select('id, nombre');
  if (error) throw error;
  console.log(`  ${data.length} zonas:`, data.map((z) => z.nombre).join(', ') || '(ninguna)');
  globalThis.__zonaNombres = uniq(data.map((z) => z.nombre));
});

await head('meseros', async () => {
  const { data, error } = await supabase.from('meseros').select('id, nombre, rol, activo').limit(200);
  if (error) throw error;
  console.log(`  ${data.length} meseros. Ejemplos:`, data.slice(0, 5).map((m) => `${m.nombre}${m.rol ? ' (' + m.rol + ')' : ''}`).join(', '));
  if (data.length === 0) console.log('  ⚠ 0 filas: revisá RLS de SELECT sobre meseros (login no funcionará).');
});

await head('asignaciones', async () => {
  const { data, error } = await supabase.from('asignaciones').select('id, zona_id, mesero_id').limit(200);
  if (error) throw error;
  console.log(`  ${data.length} asignaciones. zona_ids distintos:`, uniq(data.map((a) => a.zona_id)).slice(0, 10));
});

await head('llamados (ubicacion + estado)', async () => {
  const { data, error } = await supabase
    .from('llamados')
    .select('ubicacion, tipo, estado, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const ubic = uniq(data.map((r) => r.ubicacion));
  const estados = uniq(data.map((r) => r.estado));
  const tipos = uniq(data.map((r) => r.tipo));
  console.log(`  ${data.length} filas recientes.`);
  console.log('  estados distintos:', estados);
  console.log('  tipos distintos  :', tipos);
  console.log('  ubicaciones      :', ubic.slice(0, 15));

  const zonas = globalThis.__zonaNombres ?? [];
  if (zonas.length && ubic.length) {
    const match = ubic.filter((u) => zonas.includes(u));
    if (match.length) {
      console.log(`  ✔ ${match.length}/${ubic.length} ubicaciones coinciden con zonas.nombre → el filtro por zona funcionará.`);
    } else {
      problemas++;
      console.log('  ✖ NINGUNA ubicacion coincide con un zonas.nombre.');
      console.log('     La app asume `ubicacion == zonas.nombre`. Si tu modelo es otro,');
      console.log('     decime cómo mapear ubicacion → zona y ajusto el filtro.');
    }
  }
  const esperados = ['pendiente', 'atendido'];
  const inesperados = estados.filter((e) => !esperados.includes(e));
  if (inesperados.length) {
    problemas++;
    console.log(`  ⚠ estados fuera de lo esperado (${esperados.join('/')}):`, inesperados);
    console.log('     Ajustá ESTADO_PENDIENTE/ESTADO_ATENDIDO en src/types/db.ts.');
  }
});

await head('pedidos (ubicacion + estado)', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('ubicacion, estado, total, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  console.log(`  ${data.length} filas recientes.`);
  console.log('  estados distintos:', uniq(data.map((r) => r.estado)));
  console.log('  ubicaciones      :', uniq(data.map((r) => r.ubicacion)).slice(0, 15));
});

await head('Realtime (conexión)', async () => {
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      problemas++;
      console.log('  ⚠ Timeout: no se confirmó la suscripción en 8s.');
      console.log('     Verificá que la publicación `supabase_realtime` incluya llamados/pedidos');
      console.log('     (Dashboard → Database → Replication).');
      resolve();
    }, 8000);

    const ch = supabase
      .channel('check-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamados' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          console.log('  ✔ Realtime conectado (SUBSCRIBED).');
          supabase.removeChannel(ch);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          problemas++;
          console.log(`  ✖ Realtime status: ${status}.`);
          supabase.removeChannel(ch);
          resolve();
        }
      });
  });
});

console.log(`\n${problemas === 0 ? '✅ Todo OK.' : `⚠ ${problemas} cosa(s) para revisar (ver arriba).`}`);
process.exit(problemas === 0 ? 0 : 1);
