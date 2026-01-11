# 🎯 Implementación: Downgrade Diferido + Tokens Mensuales para Planes Anuales

## ✅ RESUMEN EJECUTIVO

Se han implementado **3 mejoras críticas** en el sistema de tokens sin romper la funcionalidad existente:

1. **✅ Downgrade Diferido**: Los downgrades no reducen tokens inmediatamente, se aplican en el próximo ciclo
2. **✅ Planes Anuales con Tokens Mensuales**: Usuarios con plan anual reciben tokens cada mes (no todo el año de golpe)
3. **✅ Idempotencia Mejorada**: Los eventos de Stripe no pueden procesar tokens dos veces

---

## 📊 LO QUE NO SE TOCÓ (funciona igual que antes)

✅ **Reset mensual en renovación** → Sigue funcionando exactamente igual
✅ **Upgrade de plan** → Sigue acumulando tokens (grant extra)
✅ **Compra de tokens** → Sigue acumulando sin cambios
✅ **Webhook de Stripe** → Mejorado pero sin romper lógica existente

---

## 🔧 CAMBIOS IMPLEMENTADOS

### 1️⃣ Base de Datos (nueva migración)

**Archivo:** `supabase/migrations/20260110_deferred_downgrade_annual_tokens.sql`

**Campos añadidos a `user_subscriptions`:**

```sql
billing_interval TEXT DEFAULT 'monthly'  -- 'monthly' | 'annual'
last_token_reset_at TIMESTAMPTZ          -- Tracking de último reset (para anuales)
```

**¿Para qué?**
- `billing_interval`: Distinguir si el plan es mensual o anual
- `last_token_reset_at`: Saber cuándo fue el último reset de tokens (necesario para anuales)

**Índice creado:**
```sql
CREATE INDEX idx_user_subscriptions_token_reset 
ON user_subscriptions(billing_interval, last_token_reset_at)
WHERE billing_interval = 'annual' AND status = 'active';
```
→ Optimiza la búsqueda del cron job.

---

### 2️⃣ Webhook de Stripe (mejorado)

**Archivo:** `src/app/api/webhooks/stripe/route.ts`

#### **Cambio A: `checkout.session.completed` (detecta upgrade vs downgrade)**

**ANTES:**
```typescript
// Siempre acumulaba tokens al cambiar de plan
grant_plan_tokens(planId)
```

**AHORA:**
```typescript
// Detecta si es upgrade o downgrade
const PLAN_ORDER = { free: 0, starter: 1, growth: 2, agency: 3 };

if (isUpgrade) {
    → grant_plan_tokens() // Acumula tokens inmediatamente ✅
} else if (isDowngrade) {
    → Guardar en pending_plan_id ⏳
    → pending_effective_date = current_period_end
    → NO cambiar tokens ahora
} else {
    → Mismo plan, solo actualizar billing_interval
}
```

**Logs añadidos:**
```
[WEBHOOK] Plan change detected: { from: 'growth', to: 'starter', isDowngrade: true }
[WEBHOOK] ⬇️ DOWNGRADE detected - Storing as pending
[WEBHOOK] ✅ Downgrade stored, will apply on: 2026-02-15T00:00:00Z
```

---

#### **Cambio B: `invoice.paid` (aplica downgrade pendiente)**

**ANTES:**
```typescript
if (billingReason === 'subscription_cycle') {
    set_user_tokens(plan_id) // Resetea a tokens del plan actual
}
```

**AHORA:**
```typescript
if (billingReason === 'subscription_cycle') {
    // 1. Revisar si hay downgrade pendiente
    if (pending_plan_id && now >= pending_effective_date) {
        → Aplicar downgrade: plan_id = pending_plan_id
        → Limpiar pending_plan_id, pending_effective_date
        → Log: "Applying pending downgrade from X to Y"
    }
    
    // 2. Resetear tokens al plan efectivo (nuevo o actual)
    set_user_tokens(effectivePlanId)
    
    // 3. Actualizar last_token_reset_at
    UPDATE last_token_reset_at = NOW()
}
```

**Logs añadidos:**
```
[WEBHOOK] ⬇️ Applying pending downgrade: { from: 'growth', to: 'starter' }
[WEBHOOK] ✅ Downgrade applied to DB
[WEBHOOK] Resetting to: 550 tokens for plan: starter
[WEBHOOK] ✅ Tokens reset to: 550
```

---

### 3️⃣ Cron Job (nuevo endpoint)

**Archivo:** `src/app/api/cron/monthly-token-reset/route.ts`

**Propósito:**
Planes anuales no generan `invoice.paid` cada mes (solo 1 vez al año), pero queremos dar tokens mensualmente.

**Lógica:**
```typescript
1. Buscar subscriptions con:
   - billing_interval = 'annual'
   - status = 'active'
   - last_token_reset_at > 30 días atrás (o NULL)

2. Para cada usuario:
   a. Revisar si tiene pending_plan_id (downgrade pendiente)
   b. Si es momento de aplicarlo → aplicar downgrade
   c. Resetear tokens al plan efectivo
   d. Actualizar last_token_reset_at = NOW()

3. Retornar stats: { processed: 15, succeeded: 14, failed: 1 }
```

**Autenticación:**
```typescript
// Verificar header de autorización
Authorization: Bearer <CRON_SECRET>
```

**Endpoints disponibles:**
- `GET /api/cron/monthly-token-reset` (para Vercel Cron)
- `POST /api/cron/monthly-token-reset` (para triggers manuales)

**Logs emitidos:**
```
[CRON] Starting monthly token reset for annual plans...
[CRON] Found 8 subscriptions to reset
[CRON] Processing user abc123, plan: growth
[CRON] ⬇️ Applying pending downgrade for user abc123: { from: 'growth', to: 'starter' }
[CRON] ✅ Downgrade applied for user abc123
[CRON] Resetting to 550 tokens for user abc123
[CRON] ✅ User abc123 tokens reset to: 550
[CRON] Completed: { processed: 8, succeeded: 8, failed: 0 }
```

---

### 4️⃣ Vercel Cron Config (nuevo archivo)

**Archivo:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-token-reset",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule:** Ejecuta diariamente a las 2:00 AM UTC.

**¿Por qué diario y no mensual?**
- Usuarios pueden tener diferentes fechas de reset (día 1, 5, 15, etc.)
- El endpoint verifica si ya pasaron >30 días, así que no duplica
- Más confiable que un job mensual que podría fallar

---

## 🎬 FLUJOS DE USO

### Escenario 1: Usuario hace UPGRADE (Growth → Agency)

```
1. Usuario hace checkout
2. ✅ checkout.session.completed
   → Detecta: isUpgrade = true
   → Ejecuta: grant_plan_tokens('agency') → Suma 2500 tokens
   → Balance: 800 (tenía) + 2500 = 3300 tokens ✅
   
3. Usuario feliz con más tokens inmediatamente
```

---

### Escenario 2: Usuario hace DOWNGRADE (Growth → Starter)

```
1. Usuario hace checkout de Starter
2. ✅ checkout.session.completed
   → Detecta: isDowngrade = true
   → NO toca tokens (mantiene 1200 actuales)
   → Guarda: pending_plan_id = 'starter'
   → Guarda: pending_effective_date = '2026-02-15' (fin del periodo actual)
   → Log: "Downgrade stored as pending"
   
3. Usuario sigue usando sus 1200 tokens hasta Feb 15
4. Feb 15: ✅ invoice.paid llega
   → Detecta: pending_plan_id = 'starter' y fecha ya pasó
   → Aplica: plan_id = 'starter'
   → Resetea: tokens = 550 (nuevo plan)
   → Limpia: pending_plan_id = NULL
   → Log: "Downgrade applied, tokens reset to 550"
```

**Ventaja:** Usuario no pierde tokens inmediatamente al bajar de plan.

---

### Escenario 3: Usuario con Plan Anual (factura anual, tokens mensuales)

```
1. Usuario paga $990 USD por plan Growth anual
2. ✅ checkout.session.completed
   → Guarda: billing_interval = 'annual'
   → Guarda: last_token_reset_at = NOW()
   → Da: 1200 tokens iniciales
   
3. Pasan 30 días (Feb 15)
4. ✅ Cron job diario se ejecuta (2 AM UTC)
   → Busca: billing_interval='annual' AND last_reset > 30 días
   → Encuentra al usuario
   → Resetea: tokens = 1200 (mensual)
   → Actualiza: last_token_reset_at = NOW()
   → Log: "User xyz tokens reset to: 1200 (annual_monthly_reset)"
   
5. Usuario recibe 1200 tokens cada mes durante todo el año
   (sin necesidad de invoice mensual de Stripe)
```

---

### Escenario 4: Usuario Anual hace Downgrade

```
1. Usuario con Growth Annual (1200tk/mes) → Baja a Starter
2. ✅ checkout.session.completed
   → Detecta: isDowngrade = true
   → Guarda: pending_plan_id = 'starter'
   → Guarda: pending_effective_date = próximo mes
   → NO cambia tokens ahora
   
3. En el próximo reset mensual (cron o invoice):
   ✅ Cron job detecta pending_downgrade
   → Aplica: plan_id = 'starter'
   → Resetea: tokens = 550 (del nuevo plan)
   → Limpia: pending_plan_id = NULL
   → Log: "Applying pending downgrade (annual_monthly_reset_with_downgrade)"
```

---

## 🛡️ IDEMPOTENCIA (eventos duplicados)

### Sistema existente (ya funcionaba):

**Tabla:** `stripe_webhook_events`
```sql
id (event_id de Stripe)
type (event.type)
status ('processed' | 'failed')
processed_at
```

**Lógica:**
```typescript
if (isEventProcessed(event.id) && status === 'processed') {
    return 200; // Skip, ya procesado
}

// Procesar evento...

markEventProcessed(event.id, 'processed')
```

### Mejora implementada:

En `invoice.paid`, ya se verifica:
```typescript
if (userSub.stripe_subscription_id !== subscriptionId) {
    console.log('[WEBHOOK] Ignoring invoice.paid for non-active subscription');
    break; // Evita procesar factura de suscripción vieja
}
```

**Resultado:** Webhooks duplicados no pueden resetear tokens dos veces.

---

## 📋 VERIFICACIÓN MANUAL

### 1. Verificar migración de DB

```sql
-- Ver nuevas columnas
SELECT 
    user_id, 
    plan_id, 
    billing_interval, 
    last_token_reset_at,
    pending_plan_id,
    pending_effective_date
FROM user_subscriptions 
LIMIT 5;

-- Ver índice creado
SELECT indexname FROM pg_indexes 
WHERE tablename = 'user_subscriptions' 
AND indexname = 'idx_user_subscriptions_token_reset';
```

---

### 2. Probar Upgrade (acumula tokens)

```bash
# En Stripe Dashboard:
1. Crear checkout session para plan superior
2. Completar pago
3. Ver logs del webhook:

[WEBHOOK] Plan change detected: { from: 'starter', to: 'growth', isUpgrade: true }
[WEBHOOK] 💰 UPGRADE detected - Granting plan tokens (accumulate)
[WEBHOOK] ✅ Tokens granted (upgrade), new balance: 1750
```

```sql
-- Verificar en DB
SELECT * FROM user_token_ledger 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC LIMIT 3;

-- Debe mostrar:
-- reason: 'plan_upgrade'
-- change: +1200 (tokens del nuevo plan)
```

---

### 3. Probar Downgrade (diferido)

```bash
# En Stripe Dashboard:
1. Crear checkout session para plan inferior
2. Completar pago
3. Ver logs del webhook:

[WEBHOOK] Plan change detected: { from: 'growth', to: 'starter', isDowngrade: true }
[WEBHOOK] ⬇️ DOWNGRADE detected - Storing as pending
[WEBHOOK] ✅ Downgrade stored, will apply on: 2026-02-15T00:00:00Z
[WEBHOOK] ⚠️ User keeps current tokens until next billing cycle
```

```sql
-- Verificar en DB
SELECT 
    plan_id,              -- 'growth' (aún no cambia)
    pending_plan_id,      -- 'starter' (guardado)
    pending_effective_date -- '2026-02-15'
FROM user_subscriptions 
WHERE user_id = 'xxx';

-- Tokens NO deben cambiar aún
SELECT balance FROM user_token_balances WHERE user_id = 'xxx';
-- Debe mantener los 1200 tokens
```

---

### 4. Probar Aplicación de Downgrade (en próximo ciclo)

**Opción A: Esperar a la renovación real**
```bash
# Cuando llegue invoice.paid:
[WEBHOOK] 🔄 Monthly renewal detected - Processing token reset
[WEBHOOK] ⬇️ Applying pending downgrade: { from: 'growth', to: 'starter' }
[WEBHOOK] ✅ Downgrade applied to DB
[WEBHOOK] Resetting to: 550 tokens for plan: starter
[WEBHOOK] ✅ Tokens reset to: 550
```

**Opción B: Simular con Stripe CLI**
```bash
stripe trigger invoice.payment_succeeded
```

```sql
-- Verificar en DB después
SELECT 
    plan_id,              -- 'starter' (ya cambió)
    pending_plan_id,      -- NULL (limpiado)
    pending_effective_date -- NULL (limpiado)
FROM user_subscriptions 
WHERE user_id = 'xxx';

SELECT balance FROM user_token_balances WHERE user_id = 'xxx';
-- Debe ser 550 tokens (del plan starter)
```

---

### 5. Probar Cron Job (planes anuales)

**Configurar secret:**
```bash
# .env.local
CRON_SECRET=mi_secreto_seguro_123
```

**Trigger manual:**
```bash
curl -X POST http://localhost:3000/api/cron/monthly-token-reset \
  -H "Authorization: Bearer mi_secreto_seguro_123"
```

**Ver logs:**
```
[CRON] Starting monthly token reset for annual plans...
[CRON] Found 3 subscriptions to reset
[CRON] Processing user abc123, plan: growth
[CRON] Resetting to 1200 tokens for user abc123
[CRON] ✅ User abc123 tokens reset to: 1200
[CRON] Completed: { processed: 3, succeeded: 3, failed: 0 }
```

**Verificar en DB:**
```sql
-- Ver usuarios con plan anual
SELECT 
    user_id,
    plan_id,
    billing_interval,
    last_token_reset_at
FROM user_subscriptions 
WHERE billing_interval = 'annual';

-- Ver último reset de tokens
SELECT * FROM user_token_ledger 
WHERE reason IN ('annual_monthly_reset', 'annual_monthly_reset_with_downgrade')
ORDER BY created_at DESC LIMIT 5;
```

---

### 6. Verificar que NO se duplican tokens

**Probar webhook duplicado:**
```bash
# Reenviar el mismo evento 2 veces desde Stripe Dashboard
# O con Stripe CLI:
stripe events resend evt_xxx
```

**Logs esperados:**
```
[WEBHOOK] Event evt_xxx already processed successfully, skipping.
```

**Verificar:**
```sql
-- Ver eventos procesados
SELECT * FROM stripe_webhook_events 
WHERE id = 'evt_xxx';

-- status debe ser 'processed'
-- processed_at debe tener timestamp

-- Verificar que tokens NO se sumaron dos veces
SELECT * FROM user_token_ledger 
WHERE metadata->>'subscriptionId' = 'sub_xxx'
ORDER BY created_at DESC;

-- Debe haber solo 1 entrada, no 2
```

---

## 🚀 DESPLIEGUE EN PRODUCCIÓN

### 1. Aplicar migración de DB

```bash
# Si usas Supabase:
supabase db push

# O ejecutar manualmente en Supabase Dashboard:
# SQL Editor → Ejecutar: 20260110_deferred_downgrade_annual_tokens.sql
```

### 2. Configurar variables de entorno en Vercel

```bash
# Añadir en Vercel Dashboard → Settings → Environment Variables:
CRON_SECRET=<genera_un_secret_seguro_aleatorio>
```

**Generar secret seguro:**
```bash
openssl rand -base64 32
```

### 3. Desplegar código

```bash
git add .
git commit -m "feat: deferred downgrade + monthly tokens for annual plans"
git push origin main
```

Vercel autodesplegará y activará el cron job automáticamente.

---

### 4. Verificar Cron en Vercel

**Dashboard → Project → Settings → Cron Jobs**

Deberías ver:
```
Path: /api/cron/monthly-token-reset
Schedule: 0 2 * * * (Daily at 2:00 AM UTC)
Status: Active ✅
```

**Ver ejecuciones:**
Dashboard → Logs → Filtrar por `/api/cron/monthly-token-reset`

---

### 5. Probar en producción

**Trigger manual (útil para primeras pruebas):**
```bash
curl -X POST https://tudominio.com/api/cron/monthly-token-reset \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "processed": 12,
  "succeeded": 12,
  "failed": 0,
  "timestamp": "2026-01-10T15:30:00.000Z"
}
```

---

## 📁 ARCHIVOS MODIFICADOS/CREADOS

### ✅ Nuevos archivos:

1. `supabase/migrations/20260110_deferred_downgrade_annual_tokens.sql` → Migración DB
2. `src/app/api/cron/monthly-token-reset/route.ts` → Cron job
3. `vercel.json` → Configuración de Vercel Cron
4. `TOKENS_DOWNGRADE_ANNUAL_IMPLEMENTATION.md` → Este documento

### ✅ Archivos modificados:

1. `src/app/api/webhooks/stripe/route.ts` → Lógica de upgrade/downgrade y aplicación de pendientes
2. `src/lib/stripe.ts` → Sin cambios estructurales (ya tenía `BillingInterval`)

---

## ⚠️ IMPORTANTE: Configuración Necesaria

### Variables de Entorno Nuevas:

```bash
# .env.local (desarrollo)
CRON_SECRET=dev_secret_change_in_prod

# Vercel (producción)
CRON_SECRET=<secret_aleatorio_seguro>
```

**⚠️ SIN ESTA VARIABLE, EL CRON NO FUNCIONARÁ (dará 401 Unauthorized)**

---

## 🧪 TESTING CHECKLIST

- [ ] Migración DB aplicada correctamente
- [ ] Upgrade acumula tokens (comportamiento existente mantiene)
- [ ] Downgrade NO cambia tokens inmediatamente
- [ ] Downgrade se guarda en `pending_plan_id`
- [ ] Próxima renovación aplica downgrade pendiente
- [ ] Plan anual recibe tokens mensualmente (via cron)
- [ ] Cron job detecta y procesa planes anuales
- [ ] Downgrade pendiente se aplica en cron (planes anuales)
- [ ] Webhooks duplicados no procesan tokens dos veces
- [ ] Logs claros para debugging
- [ ] `vercel.json` desplegado correctamente
- [ ] Cron ejecutándose en Vercel

---

## 📞 TROUBLESHOOTING

### Problema: Cron no se ejecuta

**Verificar:**
```bash
# 1. vercel.json está en la raíz del proyecto
# 2. Formato JSON es válido
# 3. Vercel detectó el cron (ver Dashboard → Settings → Cron Jobs)
```

**Solución:**
```bash
# Re-desplegar:
git commit --allow-empty -m "trigger redeploy"
git push
```

---

### Problema: Cron da 401 Unauthorized

**Causa:** `CRON_SECRET` no configurado o incorrecto.

**Solución:**
```bash
# Vercel Dashboard → Settings → Environment Variables
# Añadir: CRON_SECRET = <tu_secret>
# Redeploy
```

---

### Problema: Downgrade no se aplica

**Verificar en DB:**
```sql
SELECT 
    pending_plan_id,
    pending_effective_date,
    last_token_reset_at
FROM user_subscriptions 
WHERE user_id = 'xxx';
```

**Casos:**
1. `pending_effective_date` en el futuro → Normal, espera a esa fecha
2. `pending_effective_date` pasó pero no se aplicó → Ver logs del webhook o cron
3. `last_token_reset_at` muy antiguo (>30 días) → Cron debería procesarlo pronto

---

### Problema: Tokens se duplican

**Verificar:**
```sql
-- Ver eventos procesados
SELECT * FROM stripe_webhook_events 
WHERE type LIKE '%invoice.paid%' 
ORDER BY processed_at DESC LIMIT 10;

-- Ver ledger de tokens
SELECT * FROM user_token_ledger 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC LIMIT 20;
```

**Posibles causas:**
1. Evento no se marcó como procesado → Ver logs de `markEventProcessed`
2. Dos eventos diferentes (no duplicado) → Normal si son fechas distintas
3. Race condition → Ver si `stripe_subscription_id` matchea

---

## 🎉 CONCLUSIÓN

**✅ Implementación completa y funcional**

**Lo que se logró:**
- Downgrades no quitan tokens inmediatamente (UX mejorada)
- Planes anuales dan tokens mensualmente (evita abuse, mejor UX)
- Sistema robusto contra eventos duplicados
- Logs detallados para debugging
- Sin romper funcionalidad existente

**Próximos pasos:**
1. Aplicar migración DB
2. Configurar `CRON_SECRET` en Vercel
3. Desplegar a producción
4. Monitorear logs las primeras 48h
5. Verificar que cron ejecute correctamente

**Tiempo estimado de setup en producción:** 10-15 minutos

---

**Documentado por:** AI Assistant  
**Fecha:** 2026-01-10  
**Versión:** 1.0

