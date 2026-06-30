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

## 🔔 Notas sobre las notificaciones Android (importante)

Implementado en `src/lib/notifications.ts` y `app.config.ts`:

- **Canal de prioridad MAX** (`AndroidImportance.MAX`) → heads-up + visibilidad
  `PUBLIC` en pantalla bloqueada + `bypassDnd` (suena aunque esté "No molestar").
- **Permisos** declarados: `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`,
  `USE_FULL_SCREEN_INTENT`.
- **Vibración insistente 5 s / 5 s repetida hasta atender**: se hace con la API
  `Vibration` de React Native (`startInsistentVibration`), porque el patrón de
  vibración de un *canal* de Android **solo se reproduce una vez** — no repite
  indefinidamente. La app vibra mientras haya pendientes y corta al tocar
  "Atendido".

**Límites honestos (managed Expo):** una notificación tipo "llamada entrante" a
**pantalla completa real** sobre el lock screen, y vibración persistente con la
**app totalmente cerrada**, requieren un *Foreground Service* nativo + manejo de
`full-screen intent`, que excede el flujo managed y necesitaría un módulo/config
plugin nativo propio. La configuración actual cubre todo lo posible sin eyectar:
heads-up MAX que despierta la pantalla + vibración insistente al abrir/estando la
app activa. Si necesitás el comportamiento alarma-total con la app cerrada, se
puede agregar con un dev build y un pequeño módulo nativo — decime y lo armamos.

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
