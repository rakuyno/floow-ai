# 🚨 WEBHOOK NO FUNCIONA - GUÍA DE DEBUGGING Y FIX

**Fecha:** 18 Diciembre 2025  
**Problema:** Webhooks no están procesando pagos → no actualiza DB ni tokens

---

## 🔍 **PASO 1: DIAGNOSTICAR EL PROBLEMA**

### A) Verificar Webhook en Stripe Dashboard

1. Ve a: https://dashboard.stripe.com/webhooks
2. Busca el webhook para tu dominio de producción
3. **Si NO existe:**
   - Ese es el problema → salta al PASO 2
4. **Si existe:**
   - Haz clic en el webhook
   - Ve a "Recent deliveries"
   - Busca eventos `checkout.session.completed` recientes
   - **Si ves errores** (400, 401, 500):
     - Copia el mensaje de error
     - Ve al PASO 3

### B) Verificar Variable de Entorno en Vercel

1. Ve a: https://vercel.com/tu-proyecto/settings/environment-variables
2. Busca `STRIPE_WEBHOOK_SECRET`
3. **Si NO existe:**
   - Ese es el problema → salta al PASO 2
4. **Si existe:**
   - Verifica que sea el valor correcto del webhook de producción
   - Ve a Stripe Dashboard → Webhooks → tu webhook → "Signing secret"
   - Debe empezar con `whsec_...`
   - Si no coincide → actualiza en Vercel y redeploy

### C) Verificar Logs en Vercel

1. Ve a: https://vercel.com/tu-proyecto/deployments
2. Haz clic en el último deployment
3. Ve a "Functions" → busca `/api/webhooks/stripe`
4. Busca logs tipo:
   ```
   [WEBHOOK] Signature verification failed
   [WEBHOOK] Processing event...
   ```
5. Si ves errores, cópialos

---

## 🛠️ **PASO 2: CREAR Y CONFIGURAR WEBHOOK**

### A) Crear Webhook en Stripe Dashboard

1. Ve a: https://dashboard.stripe.com/webhooks
2. Clic en "+ Add endpoint"
3. **Endpoint URL:** `https://tu-dominio-produccion.vercel.app/api/webhooks/stripe`
4. **Events to send:** Selecciona estos eventos:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Clic en "Add endpoint"
6. **Copia el "Signing secret"** (empieza con `whsec_...`)

### B) Añadir Variable de Entorno en Vercel

1. Ve a: https://vercel.com/tu-proyecto/settings/environment-variables
2. Clic en "Add New"
3. **Name:** `STRIPE_WEBHOOK_SECRET`
4. **Value:** Pega el "Signing secret" que copiaste
5. **Environments:** Selecciona "Production"
6. Clic en "Save"
7. **IMPORTANTE:** Redeploy la aplicación para que tome el cambio

### C) Redeploy

```bash
# Opción 1: Trigger redeploy desde Vercel Dashboard
# Deployments → Latest → ... → Redeploy

# Opción 2: Push vacío
git commit --allow-empty -m "Trigger redeploy for webhook env var"
git push
```

---

## 🚑 **PASO 3: FIX MANUAL (TEMPORAL)**

Mientras configuras el webhook correctamente, usa este fix manual para arreglar las suscripciones que ya pagaste:

### A) Hacer Deploy del Fix

```bash
# Ya está creado en el código:
# - /api/billing/manual-fix (endpoint)
# - /app/billing-fix (página)

# Solo necesitas hacer push
git add .
git commit -m "Add manual subscription fix"
git push
```

### B) Ejecutar el Fix

1. Ve a: `https://tu-dominio.vercel.app/app/billing-fix`
2. Haz clic en "Ejecutar Fix"
3. El fix hará:
   - ✅ Buscar todas tus suscripciones activas en Stripe
   - ✅ Cancelar las viejas (mantener solo la más reciente)
   - ✅ Actualizar tu plan en Supabase
   - ℹ️ Mostrar tokens disponibles (NO los añade automáticamente)

### C) Verificar Resultado

1. Ve a `/app/billing` → verifica que muestre el plan correcto
2. Ve a Stripe Dashboard → verifica que solo haya 1 suscripción activa
3. **Si faltan tokens:**
   - Anota el `subscription_id` del resultado
   - Puedes añadirlos manualmente en Supabase o contactar soporte

---

## ✅ **PASO 4: VERIFICAR QUE FUNCIONA**

### Test con Stripe CLI (Local)

```bash
# 1. Instalar Stripe CLI
# Windows: https://github.com/stripe/stripe-cli/releases
# Mac: brew install stripe/stripe-tap/stripe

# 2. Login
stripe login

# 3. Forward eventos a tu localhost
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# 4. En otra terminal, trigger un evento
stripe trigger checkout.session.completed

# 5. Verificar logs en la primera terminal
# Debe decir: [WEBHOOK] Processing event... [WEBHOOK] Event marked as processed
```

### Test en Producción

1. **Opción A - Test Mode de Stripe:**
   - Ve a Stripe Dashboard (test mode)
   - Crea un checkout session de prueba
   - Paga con `4242 4242 4242 4242`
   - Verifica logs en Vercel

2. **Opción B - Resend Webhook:**
   - Ve a Stripe Dashboard → Webhooks → tu webhook
   - Busca un evento `checkout.session.completed` fallido
   - Clic en "..." → "Resend event"
   - Verifica logs en Vercel

---

## 📊 **CHECKLIST COMPLETO**

- [ ] Webhook existe en Stripe Dashboard para dominio de producción
- [ ] Webhook tiene eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`
- [ ] Variable `STRIPE_WEBHOOK_SECRET` existe en Vercel (Production)
- [ ] Variable `STRIPE_WEBHOOK_SECRET` coincide con "Signing secret" del webhook
- [ ] Redeploy hecho después de añadir variable
- [ ] Test con Stripe CLI funciona localmente
- [ ] Test en producción funciona
- [ ] Fix manual ejecutado para limpiar suscripciones viejas

---

## 🐛 **ERRORES COMUNES**

### Error: "Signature verification failed"

**Causa:** `STRIPE_WEBHOOK_SECRET` incorrecto o ausente

**Fix:**
1. Verifica que la variable existe en Vercel (Production)
2. Verifica que coincide con el "Signing secret" del webhook
3. Redeploy después de cambiar

### Error: "Webhook Error: No signatures found"

**Causa:** Stripe no está enviando el header `Stripe-Signature`

**Fix:**
1. Verifica que el webhook en Stripe apunte a la URL correcta
2. Verifica que sea POST request
3. No debe haber redirects o proxies en medio

### Error: "No user subscription found for customer"

**Causa:** El usuario no existe en Supabase o no tiene registro en `user_subscriptions`

**Fix:**
1. Verifica que el usuario exista en Supabase auth
2. Verifica que tenga un registro en `user_subscriptions`
3. El `metadata.userId` del checkout debe coincidir con Supabase user id

### Suscripciones duplicadas en Stripe

**Causa:** Webhook no funcionaba → cada cambio creaba nueva sin cancelar vieja

**Fix:**
1. Ejecuta `/app/billing-fix`
2. O cancela manualmente las viejas en Stripe Dashboard

---

## 📞 **SI NADA FUNCIONA**

1. **Revisa logs de Vercel:**
   - Functions → `/api/webhooks/stripe`
   - Busca errores específicos

2. **Revisa logs de Stripe:**
   - Webhooks → tu webhook → Recent deliveries
   - Busca errores HTTP

3. **Contacta con estos datos:**
   - Mensaje de error exacto
   - Logs de Vercel
   - Logs de Stripe
   - Usuario/email afectado
   - Subscription IDs

---

## 🎯 **RESUMEN PARA FIX RÁPIDO**

```bash
# 1. Crear webhook en Stripe Dashboard
Endpoint: https://tu-dominio.vercel.app/api/webhooks/stripe
Eventos: checkout.session.completed, invoice.paid, customer.subscription.*

# 2. Copiar signing secret (whsec_...)

# 3. Añadir a Vercel env vars
STRIPE_WEBHOOK_SECRET=whsec_...

# 4. Redeploy
git commit --allow-empty -m "Trigger redeploy"
git push

# 5. Fix manual para suscripciones existentes
https://tu-dominio.vercel.app/app/billing-fix

# 6. Verificar
- /app/billing debe mostrar plan correcto
- Stripe Dashboard debe mostrar 1 suscripción activa
```

---

**Estado:** 🚨 **CRÍTICO - WEBHOOK NO FUNCIONA**  
**Prioridad:** 🔴 **ALTA - Afecta facturación**  
**ETA:** ⏱️ **15 min (con acceso a Stripe + Vercel)**
