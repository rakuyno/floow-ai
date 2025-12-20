# 🔧 FASE 1 COMPLETADA: Mini-Fix Stripe Logic

## ✅ Cambios Implementados

### **Fix #1: Downgrades con Subscription Schedules** ✅
- **Archivo:** `src/app/api/billing/change-plan/route.ts` (NUEVO)
- **Cambio:** Los downgrades ahora crean/actualizan Stripe Subscription Schedule
- **Resultado:** Stripe aplica el cambio automáticamente en `current_period_end`
- **DB:** Solo guarda `pending_plan_id` para mostrar en UI

### **Fix #2: Upgrades sincronizados por webhook** ✅
- **Archivo:** `src/app/api/webhooks/stripe/route.ts`
- **Cambio:** `customer.subscription.updated` ahora mapea `price.id` → `plan_id` usando `STRIPE_PRICES`
- **Resultado:** DB se sincroniza automáticamente cuando Stripe actualiza la suscripción
- **Ventaja:** No hay inconsistencia si falla el prorrateo o hay retry

### **Fix #3: Dedupe tokens seguro** ✅
- **Archivo:** `src/app/api/webhooks/stripe/route.ts`
- **Cambio en `checkout.session.completed`:** Query simple sin JSONB
  ```sql
  SELECT * FROM user_token_ledger 
  WHERE user_id = X AND reason = 'subscription_initial'
  ```
- **Cambio en `invoice.paid`:** Solo recargar tokens si `billing_reason === 'subscription_cycle'`
- **Resultado:** No más duplicados de tokens

---

## 📁 Archivos Modificados/Creados

### 🆕 Nuevos (3)
1. ✅ `supabase/migrations/20250118_add_pending_plan.sql`
2. ✅ `src/app/api/billing/change-plan/route.ts`

### ✏️ Modificados (1)
3. ✅ `src/app/api/webhooks/stripe/route.ts`

---

## 🔍 Diff Resumen

### `change-plan/route.ts` (NUEVO - 228 líneas)
```typescript
// Casos manejados:
A) targetPlanId = 'free' → cancel_at_period_end: true
B) currentPlan = 'free' → needsCheckout: true (usar checkout flow)
C) Upgrade (target > current) → stripe.subscriptions.update + proration
D) Downgrade (target < current) → stripe.subscriptionSchedules.create

// Robustez:
- Fallback lookup si falta stripe_subscription_id
- Logs claros con prefijo [BILLING]
```

### `webhooks/stripe/route.ts` (Modificado)
**Cambio 1: checkout.session.completed**
```diff
- // Siempre asignar tokens iniciales
+ // ✅ Verificar si ya tiene initial tokens
+ const { data: existingInitial } = await supabaseAdmin
+     .from('user_token_ledger')
+     .select('id')
+     .eq('user_id', userId)
+     .eq('reason', 'subscription_initial')
+     .limit(1)
+     .single();
+ 
+ if (!existingInitial) {
+     // Asignar tokens solo si es primera vez
+ }
```

**Cambio 2: invoice.paid**
```diff
- // Siempre refrescar tokens
+ // ✅ Solo refrescar si es renovación real
+ const billingReason = invoice.billing_reason;
+ 
+ if (billingReason === 'subscription_cycle') {
+     // Refrescar tokens
+ } else {
+     console.log('[WEBHOOK] Not a renewal, skipping token refresh');
+ }
```

**Cambio 3: customer.subscription.updated**
```diff
- // Solo actualizar status
+ // ✅ Sincronizar plan_id desde Stripe (source of truth)
+ const priceId = subscription.items?.data?.[0]?.price?.id;
+ let syncedPlanId = null;
+ 
+ if (priceId) {
+     for (const [planKey, planPriceId] of Object.entries(STRIPE_PRICES)) {
+         if (planPriceId === priceId) {
+             syncedPlanId = planKey;
+             break;
+         }
+     }
+ }
+ 
+ if (syncedPlanId) {
+     updateData.plan_id = syncedPlanId;
+     
+     // Limpiar pending si se aplicó
+     if (userSub.pending_plan_id === syncedPlanId) {
+         updateData.pending_plan_id = null;
+         updateData.pending_effective_date = null;
+     }
+ }
```

**Cambio 4: customer.subscription.deleted**
```diff
+ // ✅ Resetear a free completamente
+ await supabaseAdmin
+     .from('user_subscriptions')
+     .update({
+         plan_id: 'free',
+         status: 'active',
+         stripe_subscription_id: null,
+         pending_plan_id: null,
+         pending_effective_date: null
+     })
```

---

## 🧪 Testing Requerido

### 1. Upgrade (Starter → Growth)
```
1. Usuario en Starter
2. POST /api/billing/change-plan { targetPlanId: 'growth' }
3. ✅ Verificar: Stripe subscription actualizada, invoice de prorrateo
4. ✅ Verificar: webhook customer.subscription.updated sincroniza plan_id=growth
5. ✅ Verificar: Tokens NO cambian (solo en próximo subscription_cycle)
```

### 2. Downgrade (Growth → Starter)
```
1. Usuario en Growth
2. POST /api/billing/change-plan { targetPlanId: 'starter' }
3. ✅ Verificar: Subscription Schedule creado en Stripe
4. ✅ Verificar: DB tiene pending_plan_id=starter
5. ✅ Verificar: UI muestra "Cambio programado"
6. Esperar a renovación real (o trigger en Stripe)
7. ✅ Verificar: Stripe aplica cambio automáticamente
8. ✅ Verificar: webhook customer.subscription.updated sincroniza plan_id=starter
9. ✅ Verificar: pending_plan_id se limpia
```

### 3. Cancelación (Growth → Free)
```
1. Usuario en Growth
2. POST /api/billing/change-plan { targetPlanId: 'free' }
3. ✅ Verificar: cancel_at_period_end=true en Stripe
4. ✅ Verificar: DB status=canceling, pending_plan_id=free
5. ✅ Verificar: UI muestra "Se cancelará el [fecha]"
6. Trigger: customer.subscription.deleted
7. ✅ Verificar: plan_id=free, status=active, subscription_id=null
```

### 4. No Duplicación de Tokens
```
1. Free → Starter checkout
2. ✅ Verificar webhook order:
   - checkout.session.completed → asigna tokens (reason: subscription_initial)
   - invoice.paid → NO duplica (billing_reason != subscription_cycle)
3. ✅ Verificar: Solo 1 entrada en ledger con reason=subscription_initial
4. Próxima renovación:
   - invoice.paid con billing_reason=subscription_cycle → recarga tokens
5. ✅ Verificar: Entrada en ledger con reason=monthly_refresh
```

---

## 🎯 Estado Actual

**Mini-Fix:** ✅ COMPLETO

**Siguiente:** FASE 2 - Retomar Plan v3 completo (URLs/UI)

---

**Ready para testing.** Los 3 fixes críticos están implementados:
1. ✅ Downgrades con Subscription Schedules
2. ✅ Sync de plan_id por webhook
3. ✅ Dedupe de tokens seguro
