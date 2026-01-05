# 🔧 Guía Completa: Corrección del Sistema de Pagos Stripe

## 📊 Diagnóstico Completo

### ✅ Estado de tu Base de Datos
- **Plan actual en DB:** Growth
- **Balance de tokens:** 290
- **Suscripción activa:** `sub_1SgOrYRrdOsS9PewF6bYL9WA` (Growth)
- **Último webhook:** ❌ **FALLÓ** (`evt_1Sm9eERrdOsS9PewNrx66Qe8`)

### 🔴 Problemas Identificados

#### 1. **Webhook Fallido (CRÍTICO)**
- **Error:** `"Could not find the 'pending_subscription_id' column of 'user_subscriptions' in the schema cache"`
- **Causa:** Supabase no reconoce la columna `pending_subscription_id`
- **Impacto:** No se actualizó tu plan a Agency ni se otorgaron los tokens

#### 2. **RPCs con nombre de columna incorrecto**
- `grant_plan_tokens` y `set_user_tokens` usaban `last_updated` 
- La columna real se llama `updated_at`
- **Impacto:** Los RPCs fallarían al ejecutarse

#### 3. **No se cancela la suscripción anterior**
- Al cambiar de plan, se crea nueva suscripción ANTES de cancelar la antigua
- **Riesgo:** Dos suscripciones activas cobrándote simultáneamente

---

## 🛠️ Soluciones Aplicadas

### ✅ 1. Migraciones Corregidas
He corregido:
- `supabase/migrations/20250118_grant_plan_tokens.sql` → usa `updated_at`
- `supabase/migrations/20250118_set_user_tokens.sql` → usa `updated_at`

### ✅ 2. Nueva Migración de Corrección
**Archivo:** `supabase/migrations/20260105_fix_stripe_integration.sql`

Esta migración:
- ✅ Fuerza la creación de columnas `pending_plan_id`, `pending_effective_date`, `pending_subscription_id`
- ✅ Recrea los RPCs `grant_plan_tokens` y `set_user_tokens` con la columna correcta
- ✅ Asegura que el schema esté sincronizado

### ✅ 3. Código Mejorado
**Archivo:** `src/app/api/billing/change-plan/route.ts`

Ahora **cancela la suscripción anterior ANTES** de crear la nueva para evitar doble cobro.

---

## 📋 PASOS A SEGUIR (EN ORDEN)

### **PASO 1: Aplicar la migración de corrección**

1. Ve a **Supabase Dashboard → SQL Editor**
2. Copia y pega el contenido de: `supabase/migrations/20260105_fix_stripe_integration.sql`
3. Ejecuta la migración
4. ✅ Deberías ver: "Success. No rows returned"

### **PASO 2: Verificar en Stripe Dashboard**

1. Ve a: https://dashboard.stripe.com/test/customers
2. Busca tu customer ID: `cus_TdgCNMJjwjthpA`
3. Ve a la pestaña **"Subscriptions"**
4. **Verifica cuántas suscripciones activas tienes:**
   - ¿Solo Growth (`sub_1SgOrYRrdOsS9PewF6bYL9WA`)?
   - ¿Growth + Agency?
   - ¿Solo Agency?

**🚨 IMPORTANTE:** Si tienes DOS suscripciones activas:
- Cancela la antigua (Growth) manualmente en Stripe
- Deja solo la nueva (Agency) activa

### **PASO 3: Obtener el ID de la suscripción Agency**

En Stripe Dashboard, copia el **Subscription ID** de la suscripción Agency (empieza con `sub_`).

Ejemplo: `sub_1Sm9eFRrdOsS9PewXXXXXXXX`

### **PASO 4: Corregir tu cuenta manualmente**

1. Abre el archivo: `supabase/migrations/20260105_manual_fix_user_account.sql`
2. En la línea que dice:
   ```sql
   v_subscription_id := 'sub_XXXXXXXXXXXX';  -- Replace with actual subscription ID
   ```
   Reemplaza `sub_XXXXXXXXXXXX` con el ID real de tu suscripción Agency

3. **DESCOMENTA** las líneas que están entre `/*` y `*/` (desde la línea ~49 hasta ~75)

4. Copia todo el script y **ejecútalo en Supabase SQL Editor**

5. ✅ Deberías ver un log como:
   ```
   Plan agency has 2500 monthly tokens
   FIX APPLIED:
   - Updated plan to: agency
   - Updated subscription_id to: sub_XXXX
   - Granted 2500 tokens
   ```

### **PASO 5: Verificar que todo está correcto**

Ejecuta estas queries en Supabase SQL Editor:

```sql
-- Ver tu suscripción
SELECT plan_id, status, stripe_subscription_id 
FROM user_subscriptions 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';
-- Debería mostrar: plan_id = 'agency'

-- Ver tu balance
SELECT balance 
FROM user_token_balances 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';
-- Debería mostrar: balance = 2790 (290 actuales + 2500 de agency)

-- Ver últimas transacciones
SELECT change, reason, created_at 
FROM user_token_ledger 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d'
ORDER BY created_at DESC 
LIMIT 3;
-- Deberías ver una entrada reciente: +2500 tokens
```

### **PASO 6: Desplegar los cambios en producción**

Si estás usando Vercel/producción:

```bash
# Pushea los cambios al repositorio
git add .
git commit -m "fix: Corrección completa del sistema de pagos Stripe"
git push origin main
```

Luego en Supabase Dashboard (producción):
1. Ve a **Database → Migrations**
2. Verifica que la migración `20260105_fix_stripe_integration` se haya aplicado
3. Si no, aplícala manualmente copiando y pegando en SQL Editor

---

## 🔍 Verificación de Variables de Entorno

Asegúrate de tener configuradas estas variables:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_AGENCY=price_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Verificar el webhook en Stripe:

1. Ve a: https://dashboard.stripe.com/test/webhooks
2. Verifica que el endpoint esté apuntando a:
   ```
   https://TU_DOMINIO.com/api/webhooks/stripe
   ```
3. Verifica que esté escuchando estos eventos:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

4. Copia el **Signing secret** y asegúrate que coincide con `STRIPE_WEBHOOK_SECRET`

---

## 🧪 Prueba Completa del Sistema

Después de aplicar todas las correcciones:

### 1. **Prueba de Subida de Plan (Free → Starter)**
1. Crea una cuenta de prueba nueva
2. Ve a la página de facturación
3. Sube al plan Starter
4. Completa el pago con tarjeta de prueba: `4242 4242 4242 4242`
5. ✅ Verifica que se actualiza el plan y se otorgan 300 tokens

### 2. **Prueba de Cambio de Plan (Starter → Growth)**
1. Cambia al plan Growth
2. Completa el pago
3. ✅ Verifica en Stripe que solo hay UNA suscripción activa (Growth)
4. ✅ Verifica que se otorgan 1000 tokens adicionales

### 3. **Prueba de Cancelación (Growth → Free)**
1. Cambia al plan Free
2. ✅ Verifica en Stripe que la suscripción se canceló
3. ✅ Verifica que el plan cambió a Free en la DB
4. ✅ Los tokens NO deben cambiar (se mantienen)

---

## 📈 Comportamiento Esperado de Tokens

### Al cambiar de plan:
- **Upgrade (starter → growth):** Se ACUMULAN tokens (+1000)
- **Downgrade (growth → starter):** Se ACUMULAN tokens (+300) - usuario no pierde lo que tiene
- **Cancelar (→ free):** Los tokens NO cambian

### Renovación mensual:
- Se RESETEAN los tokens al valor del plan
- Ejemplo: Si tienes 150 tokens restantes de Growth (1000), al renovar se resetean a 1000

---

## 🆘 Solución de Problemas

### "Webhook signature verification failed"
➜ Verifica que `STRIPE_WEBHOOK_SECRET` sea correcto (debe empezar con `whsec_`)

### "Plan not found"
➜ Verifica que los `STRIPE_PRICE_*` estén configurados correctamente

### "No Stripe customer found"
➜ El usuario debe tener al menos una suscripción creada (aunque sea Free)

### Tokens no se actualizan después del pago
1. Ve a **Supabase → Table Editor → stripe_webhook_events**
2. Busca eventos con `status = 'failed'`
3. Revisa el campo `error` para ver qué falló
4. Si es por RPCs, asegúrate de haber aplicado la migración de corrección

---

## ✅ Checklist Final

Antes de considerar todo listo:

- [ ] Migración `20260105_fix_stripe_integration.sql` aplicada
- [ ] Verificado en Stripe: solo UNA suscripción activa
- [ ] Script manual ejecutado y tokens otorgados
- [ ] Balance de tokens correcto: 2790 (o 290 + 2500)
- [ ] Plan actualizado a 'agency' en `user_subscriptions`
- [ ] Variables de entorno configuradas correctamente
- [ ] Webhook apuntando a `/api/webhooks/stripe`
- [ ] `STRIPE_WEBHOOK_SECRET` correcto
- [ ] Prueba de cambio de plan funciona correctamente
- [ ] No hay doble cobro al cambiar planes
- [ ] Logs del webhook muestran eventos procesados exitosamente

---

## 📞 Si Necesitas Más Ayuda

Si algo no funciona después de seguir estos pasos, necesitaré:

1. **Logs del webhook** (últimos 5 eventos de `stripe_webhook_events`)
2. **Estado actual de Stripe** (cuántas suscripciones activas tienes)
3. **Balance actual de tokens**
4. **Errores específicos** que aparezcan en consola o logs

---

**Creado:** 2026-01-05
**Tu User ID:** `9714f54c-a2d2-4d55-8484-23cddf7df90d`
**Customer ID en Stripe:** `cus_TdgCNMJjwjthpA`

