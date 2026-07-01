# Zafari Mesero

App móvil (React Native + Expo SDK 57, TypeScript) para los meseros del
restaurante. Complementa al sistema web existente: comparte la misma base de
datos Supabase (`meseros`, `llamados`, `pedidos`, `asignaciones`) y reacciona en
tiempo real a los llamados de mesa.

## Pantallas

- **Login** — nombre + PIN de 4 dígitos, validado contra la tabla `meseros`.
- **Panel** (equivalente a `/mesero` en la web) — llamados y pedidos pendientes
  de las zonas asignadas al mesero, con cronómetro por item y botón **Atendido**.
  Se actualiza en tiempo real (Supabase Realtime) y vibra de forma insistente
  mientras haya pendientes.
- **Historial** — llamados y pedidos ya atendidos hoy.

## Arquitectura

```
App.tsx                      Providers + navegación + setup del canal de notif.
app.config.ts                Config dinámica (FCM, permisos Android, plugin notif.)
src/
  lib/supabase.ts            Cliente Supabase (AsyncStorage + Realtime)
  lib/notifications.ts       Canal MAX, permisos, token FCM, vibración insistente
  context/AuthContext.tsx    Sesión del mesero (login PIN, zonas, persistencia)
  hooks/useFeed.ts           Datos en tiempo real: pendientes + historial
  types/db.ts                Tipos de las tablas  ⚠️ revisar nombres de columna
  navigation/RootNavigator   Gate de auth → Login o Tabs(Panel, Historial)
  screens/                   LoginScreen, PanelScreen, HistorialScreen
  components/                Cronometro, FeedCard
```

---

## ✅ Pasos que TENÉS que hacer vos antes de continuar

### 1. Conectar Supabase (rápido — la app ya queda funcional con esto)

1. En el dashboard de Supabase del proyecto web → **Project Settings → API**.
2. Copiá `Project URL` y la `anon` `public` key.
3. En la raíz del proyecto, copiá `.env.example` a `.env` y completá:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. **Realtime:** en Supabase → **Database → Replication** (o **Realtime**),
   asegurate de que las tablas `llamados` y `pedidos` tengan Realtime habilitado.
5. **RLS:** si tenés Row Level Security activo, necesitás policies que con la
   `anon` key permitan: `SELECT` en `meseros`/`asignaciones` para el login,
   y `SELECT`/`UPDATE` en `llamados`/`pedidos`. (Lo mismo que ya usa la web.)

> Con esto, **Login + Panel + Historial + Realtime ya funcionan**. Lo de Firebase
> de abajo es necesario únicamente para la **entrega de notificaciones push**
> cuando la app está cerrada/en segundo plano.

### 2. Firebase Cloud Messaging (para el push) — esto es lo que necesito de vos

1. Entrá a <https://console.firebase.google.com> y creá un proyecto (o usá uno
   existente del restaurante).
2. Dentro del proyecto: **Add app → Android**.
   - **Android package name:** `com.zafari.mesero`  *(debe coincidir EXACTO con
     `android.package` en `app.config.ts`; si querés otro, decímelo y lo cambio).*
   - Apodo y SHA-1 son opcionales para FCM.
3. Descargá el archivo **`google-services.json`** y dejalo en la raíz del
   proyecto (`/google-services.json`). Está en `.gitignore`, no se commitea.
4. En la consola de Firebase: **Project Settings → Cloud Messaging** y verificá
   que **"Firebase Cloud Messaging API (V1)"** esté **habilitada**.
5. Generá la **service account key** para que el backend pueda enviar pushes:
   **Project Settings → Service accounts → Generate new private key**. Guardá ese
   JSON (es secreto; NO lo subas al repo). Lo vas a usar para enviar las
   notificaciones desde tu backend / Edge Function de Supabase (o subirlo a EAS
   con `eas credentials` si decidimos usar el push service de Expo).

**Decime cuando tengas esto** (proyecto Firebase creado + `google-services.json`
en la raíz + confirmación de que FCM V1 está activa) y un dato más:

- ¿El package name `com.zafari.mesero` te sirve o querés otro?

### 3. Build de desarrollo (necesario para probar push)

Las notificaciones push **no funcionan en Expo Go**: hay que generar un *dev
build*. Cuando tengas Firebase listo:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

Instalás el APK resultante en un Android físico y ahí sí se prueban las
notificaciones reales. (Para iteración de UI sin push podés usar `npx expo start`
y Expo Go, pero el push y la vibración insistente requieren el dev build.)

---

## Esquema de la base (real) y suposiciones pendientes

El código está alineado a este esquema (el que pasaste). Todo el acceso a datos
está centralizado en `src/types/db.ts`, `src/hooks/useFeed.ts` y
`src/context/AuthContext.tsx`.

| Tabla          | Columnas                                                                                          |
|----------------|---------------------------------------------------------------------------------------------------|
| `meseros`      | `id`, `nombre`, `pin`, `rol`, `activo`                                                             |
| `zonas`        | `id`, `nombre`                                                                                     |
| `asignaciones` | `id`, `zona_id`, `mesero_id`                                                                       |
| `llamados`     | `id`, `ubicacion`, `tipo`, `estado`, `nombre_cliente`, `apellido_cliente`, `telefono_cliente`, `created_at`, `atendido_at` |
| `pedidos`      | `id`, `ubicacion`, `estado`, `nombre_cliente`, `telefono_cliente`, `total`, `created_at`           |

**Cómo filtra el feed por zona:** `meseros → asignaciones.zona_id → zonas.nombre`,
y luego `llamados/pedidos WHERE ubicacion IN (nombres de zonas del mesero)`.
(Confirmado: `ubicacion` es el mismo texto exacto que `zonas.nombre`, ej.
`'Cancha 1'`, `'Mesa 25'`, `'BYT Studio'`.)

### Estados (confirmados) y flujo de "Atendido"

Definidos en `src/types/db.ts`:

- **llamados** → `pendiente` → `atendido`. El botón "Atendido" lo pasa a `atendido`.
- **pedidos** → `pendiente` → `en_preparacion` → `entregado`.
  - El panel muestra los pedidos **activos** (`pendiente` + `en_preparacion`).
  - El botón "Atendido" en un pedido lo marca **`entregado`**.
  - La **vibración insistente** se dispara solo por items en `pendiente` (un
    pedido en `en_preparacion` se ve en la lista pero no mantiene la vibración).

  ¿Querés otro comportamiento? Cambialo en un solo lugar:
  `PEDIDO_ESTADOS_ACTIVOS` (qué muestra el panel) y `PEDIDO_ESTADO_AL_ATENDER`
  (a qué estado pasa el botón) en `src/types/db.ts`.

### ⚠️ Migración SQL requerida (corré esto en Supabase antes de usar la app)

La app registra **quién** atendió y **cuándo** atendió cada item. Para eso faltan
columnas. Corré esto en **Supabase → SQL Editor**:

```sql
-- 1) Hora de atención en pedidos (llamados ya tiene atendido_at).
alter table public.pedidos add column if not exists atendido_at timestamptz;

-- 2) Qué mesero atendió, en ambas tablas.
--    ⚠️ El tipo de mesero_id DEBE coincidir con el tipo de meseros.id.
--    Versión para meseros.id = uuid (lo más común en Supabase):
alter table public.llamados add column if not exists mesero_id uuid references public.meseros(id);
alter table public.pedidos  add column if not exists mesero_id uuid references public.meseros(id);

--    👉 Si meseros.id es bigint/int8 (identity), usá ESTAS dos en su lugar:
-- alter table public.llamados add column if not exists mesero_id bigint references public.meseros(id);
-- alter table public.pedidos  add column if not exists mesero_id bigint references public.meseros(id);
```

> ¿No sabés el tipo de `meseros.id`? Corré `npm run check:db` (te lo muestra) o
> mirá la tabla en el dashboard. Si dudás, en Supabase casi siempre es `uuid`.

Tras la migración, asegurate de que tus **policies de RLS de UPDATE** sobre
`llamados`/`pedidos` permitan a la `anon` key escribir `estado`, `atendido_at` y
`mesero_id` (normalmente la misma policy que ya permite marcar atendido alcanza).

### ✅ Verificación en 1 comando (corré esto en tu red)

No pude probar contra tu base porque **el entorno donde trabajo bloquea el host de
Supabase** por política de egress (`uongnbktkghwkkwllcxa.supabase.co` → 403). Para
validar login + Realtime contra tu base real, en tu compu:

```bash
npm run check:db    # = node --env-file=.env scripts/check-db.mjs
```

Te dice: cuántas zonas/meseros lee (valida RLS de SELECT), los valores reales de
`estado` y `tipo`, que las `ubicacion` coinciden con `zonas.nombre`, y prueba que
Realtime conecte. No modifica datos. Pegame la salida y confirmamos.

> Alternativa: si agregás `uongnbktkghwkkwllcxa.supabase.co` a la allowlist de
> egress de este entorno, corro la verificación yo mismo desde acá.

## 🔔 Escenarios de notificación (3 comportamientos)

El servidor envía **un solo push data-only de alta prioridad**; el dispositivo
decide cómo presentarlo. Todo esto **requiere un dev build** (no funciona en
Expo Go) y **no fue compilado/probado en este entorno** — verificalo en el build.

| # | Estado del celular | Comportamiento | Vibración | Sonido |
|---|--------------------|----------------|-----------|--------|
| **1** | Deslogueado | **Nada** (no hay token) | — | — |
| **2** | Guardado / pantalla apagada | **Llamada entrante a pantalla completa** (Full Screen Intent) con `ubicacion`, tipo y botón deslizable (→ Atender, ← Ignorar) | Tipo teléfono (fuerte-suave), máx 10 s | Según preferencia |
| **3** | En uso (pantalla encendida) | **Heads-up** (banner) con la ubicación | Corta, 1 vez (tipo WhatsApp) | Sin sonido |

**Esc1 — ciclo del token** (`src/lib/notifications.ts`, `AuthContext`): el token
FCM se guarda en `push_tokens` **solo al loguear** (`savePushToken`) y se **borra
al desloguear** (`deletePushToken`). Estando deslogueado no hay token → no llega
nada. ✅

**Esc2 — llamada entrante** (`IncomingCallScreen`, `SlideToAct`, `incomingCall.ts`):
- Full Screen Intent con **notifee** (`fullScreenAction`). El config plugin
  `plugins/withFullScreenIntent.js` marca la `MainActivity` con
  `showWhenLocked` + `turnScreenOn`; permisos `USE_FULL_SCREEN_INTENT` y
  `SYSTEM_ALERT_WINDOW` en `app.config.ts`.
- Botón deslizable: **derecha = Atender** (actualiza estado/`atendido_at`/`mesero_id`
  en Supabase igual que el botón normal), **izquierda = Ignorar** (descarta sin tocar la BD).
- Vibración tipo teléfono por máx 10 s.
- **Ringtone en loop** mientras la pantalla está visible (`expo-audio`,
  `assets/ringtone.wav`), que se corta al Atender/Ignorar o al cerrarse la
  pantalla. Respeta la preferencia: con 'Solo vibración' NO suena (pero vibra).

**Entrega FCM con RNFirebase** (`@react-native-firebase/messaging`): toda la
mensajería FCM está consolidada en RNFirebase para que el **Esc2 funcione con la
app cerrada** en celulares que matan procesos (Xiaomi/Huawei/Samsung viejos):
- `messaging().getToken()` → token (en `savePushToken`).
- `messaging().setBackgroundMessageHandler` (en `index.ts`, nivel superior) →
  `displayIncomingCall()` cuando la app está en background/cerrada.
- `messaging().onMessage` (en `App.tsx`) → `displayHeadsUp()` con la app abierta (Esc3).
- Se eliminó el background task de expo-notifications para evitar doble disparo y
  conflicto de `FirebaseMessagingService`. expo-notifications queda solo para
  canales/permisos.

**Esc3 — heads-up** (canal `llamados`, importancia HIGH, `sound: null`): vibración
corta una vez, sin sonido, auto-dismiss ~5 s (lo maneja el SO). El mesero ve el
pendiente al entrar a la app.

**Preferencias de sonido** (`PreferencesScreen`, ícono ⚙️ en el header del panel):
'Sonido + vibración' / 'Solo vibración', guardado en AsyncStorage. **Afecta solo
al Esc2**; el Esc3 siempre es sin sonido.

**Onboarding** (`OnboardingScreen`, primer login): explica y abre el ajuste de
Android **"Mostrar sobre otras apps"** (`SYSTEM_ALERT_WINDOW`) vía
`expo-intent-launcher`. Necesario para el Esc2.

### ⚠️ Lo que hay que verificar en el dev build

- **No pude compilar/probar Android** desde este entorno: el código typechea y
  `expo config --introspect` resuelve OK, pero el comportamiento real (FSI sobre
  el bloqueo, entrega con app cerrada, ringtone) se valida en el dev build.
- **RNFirebase + expo-notifications conviven**: RNFirebase es dueño de la
  mensajería FCM; expo-notifications se usa solo para canales/permisos. Si en el
  build aparece un conflicto del `FirebaseMessagingService`, la solución es dejar
  de usar expo-notifications para push (mover la creación de canales a notifee, que
  ya está integrado). Verificarlo al primer build.
- `SYSTEM_ALERT_WINDOW` requiere que el mesero lo **active a mano** la primera vez
  (por eso el onboarding).
- El ringtone es un WAV sintetizado (`assets/ringtone.wav`). Si querés otro sonido,
  reemplazá ese archivo.

## 🧾 Historial: quién atendió y a qué hora

El historial nativo (`useHistorial` + `FeedCard` en modo `historial`) ya consulta
`mesero_id` y `atendido_at`, resuelve `mesero_id → meseros.nombre`, y muestra
**"Atendido por {nombre} · HH:MM"** en cada item. Requiere la migración que agregó
`mesero_id`/`atendido_at` (ya corrida).

> ⚠️ **La web `/mesero` y `/tablero` es OTRO repositorio** que no está en este
> proyecto, así que ese cambio no lo puedo hacer desde acá. Del lado de datos ya
> está todo (columnas `mesero_id` y `atendido_at` pobladas al atender), así que en
> la web solo hay que hacer el `select` de esas columnas + join a `meseros` para
> mostrar nombre y hora. Si me pasás acceso a ese repo, lo hago.

## 📲 Pipeline de push (FCM) — setup completo

Cómo viaja un llamado hasta el celular del mesero:

```
INSERT en llamados/pedidos
   └─ Database Webhook (Supabase)
        └─ Edge Function `notify-llamado`
             ├─ ubicacion → zonas.id → asignaciones → meseros
             ├─ push_tokens de esos meseros
             └─ FCM v1 (canal "llamados", prioridad alta) → 📱 heads-up + vibración
```

La app registra su token FCM en `push_tokens` al loguearse
(`savePushToken` en `src/lib/notifications.ts`, llamado desde `AuthContext`).

### A. Firebase (lo hacés vos en la consola)

1. <https://console.firebase.google.com> → creá el proyecto.
2. **Add app → Android**, package name **`com.zafari.mesero`**.
3. Descargá **`google-services.json`** → ponelo en la raíz del repo (gitignoreado).
4. **Project Settings → Cloud Messaging**: confirmá que **FCM API (V1)** esté habilitada.
5. **Project Settings → Service accounts → Generate new private key** → guardá ese
   JSON (es secreto). Es el que la Edge Function usa para enviar (paso C).

### B. Tabla de tokens (SQL)

Corré `supabase/sql/push_tokens.sql` en **Supabase → SQL Editor**.

### C. Desplegar la Edge Function

Con la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref uongnbktkghwkkwllcxa

# Secreto: el JSON del service account de Firebase (paso A.5)
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat ruta/a/service-account.json)"
# Opcional pero recomendado: secreto compartido con el webhook
supabase secrets set WEBHOOK_SECRET="un-valor-largo-al-azar"

# Deploy (sin verificación de JWT: la protege el WEBHOOK_SECRET)
supabase functions deploy notify-llamado --no-verify-jwt
```

(`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase sola.)

### D. Database Webhooks

En **Supabase → Database → Webhooks → Create**, creá DOS webhooks (uno por tabla):

- **Tabla:** `llamados` / **Eventos:** `INSERT` → **HTTP POST** a la URL de la función
  `https://uongnbktkghwkkwllcxa.functions.supabase.co/notify-llamado`
- **Tabla:** `pedidos` / **Eventos:** `INSERT` → misma URL.

En ambos, agregá el header **`x-webhook-secret`** con el mismo valor que
`WEBHOOK_SECRET`. (Si no usaste secreto, omitilo.)

### E. Probar

1. Build de desarrollo en un Android físico (`eas build --profile development -p android`).
2. Logueate (se registra el token).
3. Insertá un `llamado` de prueba en una `ubicacion` de una zona asignada a ese
   mesero → debería llegar el heads-up con vibración.

> **Recordá el límite Android documentado abajo:** el push llega como heads-up MAX
> (despierta la pantalla); la vibración insistente 5s/5s la mantiene la app al
> abrirse. El modo "alarma a pantalla completa con app cerrada" necesita un módulo
> nativo extra.

## 🔐 Nota de seguridad sobre el PIN

El login compara el PIN en texto plano contra `meseros.pin`. Si en la BD el PIN
está hasheado (recomendado), esa validación debe moverse a una Edge Function de
Supabase que reciba `nombre`+`pin` y devuelva la sesión. Decime cómo está hoy en
la web y lo alineamos.

## Cómo correr

```bash
npm install
cp .env.example .env   # y completá las credenciales de Supabase
npx expo start         # UI en Expo Go (sin push)
# Para push real: dev build con EAS (ver paso 3 arriba)
```
