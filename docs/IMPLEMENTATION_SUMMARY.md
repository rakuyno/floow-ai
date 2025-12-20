# Stripe Integration - Implementation Summary

## ✅ Cambios Implementados

### FASE A — Base de Datos (Idempotencia)

**Archivo creado:** `supabase/migrations/20250118_stripe_webhook_idempotency.sql`

- ✅ Tabla `stripe_webhook_events` para tracking de eventos procesados
- ✅ Columnas: `id`, `type`, `processed_at`, `data`, `status`, `error`
- ✅ Índices por type, processed_at, status para performance
- ✅ Función de limpieza automática (90 días)

### FASE B — Webhook con Idempotencia

**Archivo modificado:** `src/app/api/webhooks/stripe/route.ts`

**Cambios aplicados:**

1. **Funciones de idempotencia:**
   - `isEventProcessed(eventId)` - verifica si evento ya fue procesado
   - `markEventProcessed(eventId, type, data, status, error)` - marca evento como procesado

2. **Flujo mejorado:**
   ```
   1. Verificar firma Stripe (existente)
   2. Verificar si evento ya fue procesado (NUEVO ✨)
   3. Si ya procesado → return 200 inmediato
   4. Si no → procesar lógica existente
   5. Al final → marcar como procesado (NUEVO ✨)
   6. Si falla → marcar como failed con error (NUEVO ✨)
   ```

3. **Nuevo evento manejado:**
   - `invoice.payment_failed` → marca subscription como `past_due`
   - No deduce tokens (Stripe reintentará automáticamente)

4. **Logs mejorados:**
   - Cada evento ahora registra su procesamiento
   - Logs estructurados con prefijo `[WEBHOOK]`
   - Warnings para casos edge (customer no encontrado, etc.)

### FASE C — Unificación de UI

**Archivo modificado:** `src/app/app/billing/page.tsx`

**Cambios:**
- ✅ Convertido a página de redirect simple
- ✅ Redirige a `/dashboard/billing` preservando query params (`?success=true`, etc.)
- ✅ UI de loading durante redirect
- ✅ Logs de debugging
- ⚠️ **No eliminado** - mantiene compatibilidad con links existentes

**Página principal:** `/dashboard/billing` (sin cambios)

### FASE D — Documentación

**Archivos creados:**

1. `docs/STRIPE_SETUP.md` - Guía completa de setup
   - Variables de entorno requeridas
   - Configuración de Stripe Dashboard
   - Endpoints y su uso
   - Testing con Stripe CLI
   - Troubleshooting

2. `docs/ENV_VARIABLES.md` - Template de variables de entorno
   - Todas las keys necesarias
   - Instrucciones para obtenerlas
   - Notas de seguridad

3. `docs/IMPLEMENTATION_SUMMARY.md` - Este archivo

---

## 📊 Resumen de Archivos Tocados

### Archivos Creados (3)
- ✅ `supabase/migrations/20250118_stripe_webhook_idempotency.sql`
- ✅ `docs/STRIPE_SETUP.md`
- ✅ `docs/ENV_VARIABLES.md`

### Archivos Modificados (2)
- ✅ `src/app/api/webhooks/stripe/route.ts` (webhook con idempotencia)
- ✅ `src/app/app/billing/page.tsx` (redirect a /dashboard/billing)

### Archivos NO Tocados (preservados)
- ⚠️ `src/app/api/stripe/*` - sistema antiguo (deprecado pero no eliminado)
- ⚠️ `src/app/api/billing/*` - sistema activo (sin cambios)
- ⚠️ `src/app/dashboard/billing/page.tsx` - página principal (sin cambios)
- ⚠️ `profiles` table - tabla antigua (deprecada pero no eliminada)
- ⚠️ Todo el resto del código existente

---

## 🧪 Pasos para Probar en Local

### 1. Aplicar Migración de Base de Datos

**Opción A: Supabase CLI**
```bash
cd c:\Users\Usuario\Desktop\floow
supabase db push
```

**Opción B: Manual en Supabase Dashboard**
1. Ve a tu proyecto Supabase
2. Abre **SQL Editor**
3. Copia y pega el contenido de `supabase/migrations/20250118_stripe_webhook_idempotency.sql`
4. Ejecuta

**Verificar:**
```sql
-- Verifica que la tabla existe
SELECT * FROM stripe_webhook_events LIMIT 1;
```

### 2. Configurar Stripe CLI (Testing Local)

```bash
# Instalar Stripe CLI (si no lo tienes)
# Windows: scoop install stripe
# macOS: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks a tu servidor local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Importante:** Copia el webhook secret que muestra (empieza con `whsec_...`) y agrégalo a tu `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

### 4. Probar Redirect de Billing

1. Ve a: `http://localhost:3000/app/billing`
2. Deberías ser redirigido a: `http://localhost:3000/dashboard/billing`
3. Verifica en consola del navegador: `[BILLING REDIRECT] Redirecting to: /dashboard/billing`

### 5. Probar Checkout (Sin Idempotencia Todavía)

1. Ve a: `http://localhost:3000/dashboard/billing`
2. Haz clic en "Upgrade" en cualquier plan
3. Completa checkout con tarjeta de prueba: `4242 4242 4242 4242`
4. Deberías ser redirigido de vuelta con `?success=true`

**Verificar en logs del servidor:**
```
[WEBHOOK] Processing event evt_... of type checkout.session.completed
[WEBHOOK] Subscription updated to active for user: ...
[WEBHOOK] Tokens refreshed: 300 for user: ...
[WEBHOOK] Event evt_... marked as processed
```

**Verificar en base de datos:**
```sql
-- Ver evento procesado
SELECT * FROM stripe_webhook_events 
WHERE type = 'checkout.session.completed' 
ORDER BY processed_at DESC 
LIMIT 1;

-- Ver tokens agregados
SELECT * FROM user_token_ledger 
WHERE reason = 'subscription_initial' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 6. Probar Idempotencia (CRÍTICO)

**Método 1: Stripe CLI (Recomendado)**
```bash
# Trigger el mismo evento dos veces
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed
```

**Método 2: Replay desde Dashboard**
1. Ve a [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Encuentra tu endpoint local
3. Ve a "Attempted events"
4. Busca un evento `checkout.session.completed`
5. Haz clic en "⋮" → "Resend"
6. Hazlo 2 veces

**Verificar:**

Logs del servidor deben mostrar:
```
Primera ejecución:
[WEBHOOK] Processing event evt_1234... of type checkout.session.completed
[WEBHOOK] Subscription updated...
[WEBHOOK] Tokens refreshed: 300...
[WEBHOOK] Event evt_1234... marked as processed

Segunda ejecución (mismo event ID):
[WEBHOOK] Event evt_1234... already processed, skipping.
```

Base de datos debe tener **UN SOLO** registro:
```sql
SELECT COUNT(*) FROM stripe_webhook_events WHERE id = 'evt_1234...';
-- Resultado: 1 (no 2!)

SELECT COUNT(*) FROM user_token_ledger WHERE reason = 'subscription_initial';
-- Resultado: 1 (tokens NO duplicados!)
```

### 7. Probar Payment Failed

```bash
stripe trigger invoice.payment_failed
```

**Verificar:**
```sql
-- Subscription debe estar en past_due
SELECT status FROM user_subscriptions WHERE user_id = '...';
-- Resultado: past_due

-- Tokens NO deben cambiar
SELECT balance FROM user_token_balances WHERE user_id = '...';
-- Resultado: mismo balance
```

### 8. Probar Invoice Paid (Renovación)

```bash
stripe trigger invoice.paid
```

**Verificar:**
```sql
-- Status debe volver a active
SELECT status FROM user_subscriptions WHERE user_id = '...';
-- Resultado: active

-- Tokens deben refrescarse
SELECT * FROM user_token_ledger 
WHERE reason = 'monthly_refresh' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 🚀 Pasos para Probar en Stripe Dashboard (Producción)

### 1. Configurar Webhook en Dashboard

1. Ve a [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Haz clic en **"Add endpoint"**
3. Endpoint URL: `https://tudominio.com/api/webhooks/stripe`
4. Selecciona estos eventos:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copia el **Signing secret** (empieza con `whsec_...`)
6. Agrégalo a tu archivo de entorno de producción

### 2. Actualizar Variables de Entorno (Producción)

```bash
# En tu plataforma de hosting (Vercel, Netlify, etc.)
STRIPE_SECRET_KEY=sk_live_...  # ⚠️ Usa key de producción
STRIPE_WEBHOOK_SECRET=whsec_...  # Del webhook endpoint
NEXT_PUBLIC_APP_URL=https://tudominio.com
```

### 3. Test de Smoke en Producción

**⚠️ IMPORTANTE:** Usa modo test primero, luego small amount en modo live

1. Crea un usuario de prueba
2. Completa checkout con tarjeta de prueba (si en test mode) o monto pequeño (€0.50)
3. Verifica:
   - ✅ Webhook recibido en Stripe Dashboard > Webhooks > "Attempted events"
   - ✅ Response 200 OK
   - ✅ Tokens asignados en base de datos
   - ✅ Evento en `stripe_webhook_events`

4. Trigger el mismo webhook nuevamente (Resend desde Dashboard)
5. Verifica idempotencia: tokens NO duplicados

---

## 📝 Checklist de Verificación

### Funcionalidad Básica
- [ ] Migración aplicada correctamente
- [ ] Stripe CLI conectado y funcionando
- [ ] Redirect `/app/billing` → `/dashboard/billing` funciona
- [ ] Checkout completo funciona
- [ ] Webhook recibido y procesado

### Idempotencia (CRÍTICO)
- [ ] Evento duplicado no procesa dos veces
- [ ] `stripe_webhook_events` tiene registro del evento
- [ ] Tokens NO se duplican en evento repetido
- [ ] Logs muestran "already processed, skipping"

### Eventos de Stripe
- [ ] `checkout.session.completed` → asigna tokens iniciales
- [ ] `invoice.paid` → refresca tokens mensuales
- [ ] `invoice.payment_failed` → marca como past_due (sin quitar tokens)
- [ ] `customer.subscription.updated` → actualiza status
- [ ] `customer.subscription.deleted` → marca como canceled

### Logs y Debugging
- [ ] Logs con prefijo `[WEBHOOK]` en consola
- [ ] Errores guardados en `stripe_webhook_events.error`
- [ ] Status `processed` para eventos exitosos
- [ ] Status `failed` para eventos con error

---

## 🐛 Troubleshooting Común

### Error: "No module named stripe_webhook_events"

**Causa:** Migración no aplicada

**Solución:**
```bash
supabase db push
# O aplica manualmente el SQL en Supabase Dashboard
```

### Error: "Webhook Error: No signatures found matching the expected signature"

**Causa:** `STRIPE_WEBHOOK_SECRET` incorrecto o no configurado

**Solución:**
1. Para local: usa el secret del `stripe listen`
2. Para producción: usa el secret del webhook endpoint en Dashboard

### Tokens Duplicados

**Causa:** Idempotencia no funciona o migración no aplicada

**Verificación:**
```sql
-- Busca eventos duplicados
SELECT id, COUNT(*) 
FROM stripe_webhook_events 
GROUP BY id 
HAVING COUNT(*) > 1;

-- Busca entradas duplicadas en ledger
SELECT user_id, reason, metadata->>'subscriptionId', COUNT(*)
FROM user_token_ledger
WHERE reason = 'subscription_initial'
GROUP BY user_id, reason, metadata->>'subscriptionId'
HAVING COUNT(*) > 1;
```

### Webhook dice "already processed" pero tokens no se asignaron

**Causa:** Evento marcado como `failed` en intento anterior

**Verificación:**
```sql
SELECT * FROM stripe_webhook_events WHERE status = 'failed';
```

**Solución:**
1. Revisa el campo `error` para ver qué falló
2. Corrige el problema
3. Borra el registro del evento fallido:
   ```sql
   DELETE FROM stripe_webhook_events WHERE id = 'evt_xxx';
   ```
4. Reenvía el webhook desde Stripe Dashboard

---

## 🔍 Queries Útiles de Debugging

```sql
-- Ver últimos eventos procesados
SELECT id, type, status, processed_at, error
FROM stripe_webhook_events
ORDER BY processed_at DESC
LIMIT 10;

-- Ver últimos movimientos de tokens
SELECT user_id, change, reason, metadata, created_at
FROM user_token_ledger
ORDER BY created_at DESC
LIMIT 20;

-- Ver balance actual de un usuario
SELECT u.email, b.balance, s.plan_id, s.status
FROM user_token_balances b
JOIN auth.users u ON u.id = b.user_id
LEFT JOIN user_subscriptions s ON s.user_id = b.user_id
WHERE u.email = 'test@example.com';

-- Ver eventos fallidos
SELECT id, type, error, processed_at
FROM stripe_webhook_events
WHERE status = 'failed'
ORDER BY processed_at DESC;

-- Limpiar eventos antiguos (90+ días)
SELECT cleanup_old_webhook_events();
```

---

## 📌 Próximos Pasos (Opcional)

Si quieres extender la integración:

1. **Agregar más eventos:**
   - `customer.subscription.trial_will_end` - notificar fin de trial
   - `invoice.upcoming` - notificar próximo cargo
   - `payment_intent.payment_failed` - manejo más granular de fallos

2. **Mejorar error handling:**
   - Retry logic personalizado
   - Notificaciones de admin para eventos failed
   - Dashboard interno de webhooks

3. **Cleanup de código antiguo** (cuando estés seguro):
   - Eliminar `src/app/api/stripe/*`
   - Eliminar campos `stripe_*` de tabla `profiles`
   - Actualizar referencias en código

4. **Testing automatizado:**
   - Tests de integración con Stripe mocks
   - Tests de idempotencia
   - Tests de race conditions

---

## ✅ Confirmación Final

Después de probar todo, confirma:

- [ ] Idempotencia funciona (evento duplicado no causa problemas)
- [ ] Tokens se asignan correctamente
- [ ] Payment failures no rompen nada
- [ ] Logs son claros y útiles
- [ ] Documentación está actualizada

**Estado:** ✅ LISTO PARA PRODUCCIÓN (después de testing completo)

---

**Última actualización:** Enero 2025
**Versión:** 1.0.0
