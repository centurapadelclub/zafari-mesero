/**
 * Edge Function: notify-llamado
 *
 * Se dispara desde un Database Webhook de Supabase cuando se INSERTA una fila en
 * `llamados` o `pedidos`. Busca los meseros asignados a la zona de esa ubicación
 * y les envía un push por FCM v1 con prioridad alta (canal "llamados" = heads-up).
 *
 * Flujo de zona:  record.ubicacion == zonas.nombre  -> zona_id
 *                 -> asignaciones (mesero_id)  -> push_tokens (token)
 *
 * Variables de entorno (configurar con `supabase secrets set`):
 *   FCM_SERVICE_ACCOUNT  -> JSON completo del service account de Firebase (string)
 *   WEBHOOK_SECRET       -> (opcional) secreto compartido; si está, se valida el
 *                           header x-webhook-secret del webhook.
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  -> inyectadas automáticamente.
 *
 * Deploy:
 *   supabase functions deploy notify-llamado --no-verify-jwt
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';

// ---- Helpers base64url ----
function base64urlFromString(str: string): string {
  return base64urlFromBytes(new TextEncoder().encode(str));
}
function base64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---- OAuth: service account JWT -> access token ----
function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(
    JSON.stringify(claim),
  )}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64urlFromBytes(new Uint8Array(sigBuf))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`No se pudo obtener access token de Google: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

// ---- Consultas a Supabase (REST con service role) ----
async function sb<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase REST ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// ---- Construcción del mensaje según la tabla ----
function buildContent(table: string, record: Record<string, unknown>) {
  const ubic = String(record.ubicacion ?? '');
  const cliente = [record.nombre_cliente, record.apellido_cliente].filter(Boolean).join(' ').trim();

  if (table === 'pedidos') {
    const total = record.total != null ? ` · $${record.total}` : '';
    return {
      title: `🍽️ Nuevo pedido — ${ubic}`,
      body: `${cliente || 'Cliente'}${total}`,
    };
  }
  // llamados
  const tipo = record.tipo ? ` (${record.tipo})` : '';
  return {
    title: `🔔 Llamado — ${ubic}`,
    body: `${cliente || 'Mesa'} necesita atención${tipo}`,
  };
}

// ---- Envío FCM v1 (mensaje HÍBRIDO notification + data, alta prioridad) ----
// notification: Android lo muestra automáticamente en la barra cuando la app
//   está en segundo plano / cerrada (garantiza que SIEMPRE se vea el aviso).
// data: se mantiene igual para que la app procese la llamada (Full Screen Intent
//   / heads-up) cuando está abierta (onMessage) o al tocar la notificación.
async function sendFcm(
  accessToken: string,
  projectId: string,
  token: string,
  data: Record<string, string>,
  notification: { title: string; body: string },
): Promise<{ ok: boolean; status: number }> {
  const message = {
    message: {
      token,
      notification, // { title, body } — mostrado por el sistema en background
      data,
      android: {
        priority: 'high', // despierta el dispositivo para procesar el push
        notification: {
          channel_id: 'llamados', // canal HIGH creado por la app (heads-up)
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    },
  );
  const bodyText = await res.text();
  const suffix = `...${token.slice(-8)}`;
  // 5) Resultado de CADA envío FCM (status + body de la respuesta de FCM).
  console.log(`[notify] FCM send token=${suffix} -> status=${res.status} body=${bodyText}`);
  return { ok: res.ok, status: res.status };
}

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
      return new Response('unauthorized', { status: 401 });
    }

    const payload = (await req.json()) as WebhookPayload;
    const { table, record } = payload;

    if (!record || (table !== 'llamados' && table !== 'pedidos')) {
      return new Response(JSON.stringify({ skipped: 'tabla/record no aplica' }), { status: 200 });
    }
    // Solo notificamos lo que entra como pendiente.
    if (record.estado && record.estado !== 'pendiente') {
      return new Response(JSON.stringify({ skipped: `estado=${record.estado}` }), { status: 200 });
    }

    const ubicacion = String(record.ubicacion ?? '');
    // 1) Qué ubicacion recibió.
    console.log(`[notify] tabla=${table} estado=${record.estado} ubicacion="${ubicacion}"`);
    if (!ubicacion) {
      return new Response(JSON.stringify({ skipped: 'sin ubicacion' }), { status: 200 });
    }

    // 1) ubicacion -> zona_id
    const zonas = await sb<{ id: string }[]>(
      `zonas?nombre=eq.${encodeURIComponent(ubicacion)}&select=id`,
    );
    // 2) Cuántas zonas encontró.
    console.log(`[notify] zonas encontradas=${zonas.length} ids=${JSON.stringify(zonas.map((z) => z.id))}`);
    if (!zonas.length) {
      return new Response(JSON.stringify({ skipped: 'zona no encontrada', ubicacion }), { status: 200 });
    }
    const zonaIds = zonas.map((z) => z.id);

    // 2) zona_id -> meseros asignados
    const asigs = await sb<{ mesero_id: string }[]>(
      `asignaciones?zona_id=in.(${zonaIds.join(',')})&select=mesero_id`,
    );
    const meseroIds = [...new Set(asigs.map((a) => a.mesero_id))];
    // 3) Cuántos meseros asignados encontró.
    console.log(`[notify] meseros asignados=${meseroIds.length} ids=${JSON.stringify(meseroIds)}`);
    if (!meseroIds.length) {
      return new Response(JSON.stringify({ skipped: 'sin meseros asignados' }), { status: 200 });
    }

    // 3) meseros -> tokens
    const tokens = await sb<{ token: string }[]>(
      `push_tokens?mesero_id=in.(${meseroIds.join(',')})&select=token`,
    );
    // 4) Cuántos tokens encontró en push_tokens.
    console.log(
      `[notify] tokens en push_tokens=${tokens.length} sufijos=${JSON.stringify(
        tokens.map((t) => `...${t.token.slice(-8)}`),
      )}`,
    );
    if (!tokens.length) {
      return new Response(JSON.stringify({ skipped: 'sin tokens registrados' }), { status: 200 });
    }

    // 4) Enviar FCM
    const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT')!) as ServiceAccount;
    console.log(`[notify] service account project_id=${sa.project_id}`);
    const accessToken = await getAccessToken(sa);
    const content = buildContent(table, record);
    const data: Record<string, string> = {
      kind: table === 'pedidos' ? 'pedido' : 'llamado',
      id: String(record.id ?? ''),
      ubicacion,
      tipo: record.tipo != null ? String(record.tipo) : '',
      title: content.title,
      body: content.body,
    };
    // Bloque `notification` (lo muestra Android automáticamente en background).
    const notification =
      table === 'pedidos'
        ? { title: `Nuevo pedido — ${ubicacion}`, body: 'Toca para ver' }
        : { title: `Te llaman de ${ubicacion}`, body: 'Toca para atender' };

    const results = await Promise.all(
      tokens.map((t) => sendFcm(accessToken, sa.project_id, t.token, data, notification)),
    );
    const okCount = results.filter((r) => r.ok).length;
    // Resumen final del envío.
    console.log(`[notify] resumen: enviados_ok=${okCount}/${tokens.length} ubicacion="${ubicacion}"`);

    return new Response(
      JSON.stringify({
        ubicacion,
        zonas: zonas.length,
        meseros: meseroIds.length,
        tokens: tokens.length,
        enviados_ok: okCount,
        resultados: results.map((r) => r.status),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('notify-llamado error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
