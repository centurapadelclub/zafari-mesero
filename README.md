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

## ⚠️ Suposiciones de esquema (revisá esto)

No conozco los nombres reales de tus columnas. Asumí esta estructura — si difiere,
ajustá `src/types/db.ts` y los `select(...)` de `src/hooks/useFeed.ts` y
`src/context/AuthContext.tsx` (todo el acceso a datos está centralizado ahí):

| Tabla         | Columnas asumidas                                                                 |
|---------------|-----------------------------------------------------------------------------------|
| `meseros`     | `id`, `nombre`, `pin`, `activo`                                                    |
| `asignaciones`| `id`, `mesero_id`, `zona` (texto)                                                  |
| `llamados`    | `id`, `mesa`, `zona`, `estado` (`pendiente`/`atendido`), `created_at`, `atendido_at`, `mesero_id` |
| `pedidos`     | `id`, `mesa`, `zona`, `estado`, `descripcion`, `created_at`, `atendido_at`, `mesero_id` |

La relación mesero↔zona se hace por el texto de `zona` (debe coincidir entre
`asignaciones` y `llamados`/`pedidos`). Si en realidad usás `zona_id` numérico,
avisame y lo cambio.

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
