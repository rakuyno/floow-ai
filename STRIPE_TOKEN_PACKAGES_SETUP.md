# 🪙 Configuración de Paquetes de Tokens en Stripe

## 📋 Resumen de Implementación

Se ha implementado la funcionalidad de compra de tokens puntuales (one-time) que complementa los planes de suscripción.

---

## 🎯 Paquetes de Tokens

| Tokens | Precio | Escenas | €/token |
|--------|--------|---------|---------|
| 100    | €15    | 10      | €0.15   |
| 300    | €39    | 30      | €0.13   |
| 600    | €69    | 60      | €0.115  |
| 1200   | €129   | 120     | €0.107  |
| 3000   | €299   | 300     | €0.10   |
| 6000   | €549   | 600     | €0.0915 |

---

## 🔧 Configuración en Stripe Dashboard

### Paso 1: Crear Productos

1. Ve a: https://dashboard.stripe.com/test/products
2. Para cada paquete, crea un nuevo producto:

#### Producto 1: 100 Tokens
- **Nombre:** 100 Tokens
- **Descripción:** Paquete de 100 tokens para generar aproximadamente 10 escenas
- **Tipo de precio:** One-time (NO recurring)
- **Precio:** €15
- **Copia el Price ID** (empieza con `price_`)

#### Producto 2: 300 Tokens
- **Nombre:** 300 Tokens
- **Descripción:** Paquete de 300 tokens para generar aproximadamente 30 escenas
- **Tipo de precio:** One-time
- **Precio:** €39
- **Copia el Price ID**

#### Producto 3: 600 Tokens
- **Nombre:** 600 Tokens
- **Descripción:** Paquete de 600 tokens para generar aproximadamente 60 escenas (Mejor valor)
- **Tipo de precio:** One-time
- **Precio:** €69
- **Copia el Price ID**

#### Producto 4: 1200 Tokens
- **Nombre:** 1200 Tokens
- **Descripción:** Paquete de 1200 tokens para generar aproximadamente 120 escenas
- **Tipo de precio:** One-time
- **Precio:** €129
- **Copia el Price ID**

#### Producto 5: 3000 Tokens
- **Nombre:** 3000 Tokens
- **Descripción:** Paquete de 3000 tokens para generar aproximadamente 300 escenas
- **Tipo de precio:** One-time
- **Precio:** €299
- **Copia el Price ID**

#### Producto 6: 6000 Tokens
- **Nombre:** 6000 Tokens  
- **Descripción:** Paquete de 6000 tokens para generar aproximadamente 600 escenas (Máximo ahorro)
- **Tipo de precio:** One-time
- **Precio:** €549
- **Copia el Price ID**

---

### Paso 2: Configurar Variables de Entorno

Añade los Price IDs a tu archivo `.env.local`:

```env
# Stripe Token Packages
STRIPE_PRICE_100TK=price_xxxxxxxxxxxxx
STRIPE_PRICE_300TK=price_xxxxxxxxxxxxx
STRIPE_PRICE_600TK=price_xxxxxxxxxxxxx
STRIPE_PRICE_1200TK=price_xxxxxxxxxxxxx
STRIPE_PRICE_3000TK=price_xxxxxxxxxxxxx
STRIPE_PRICE_6000TK=price_xxxxxxxxxxxxx
```

**IMPORTANTE:** Si estás en producción (Vercel), añade estas variables también en:
- Vercel Dashboard → Tu proyecto → Settings → Environment Variables

---

### Paso 3: Verificar el Webhook

El webhook existente (`/api/webhooks/stripe`) ya está preparado para manejar las compras de tokens.

Asegúrate de que esté escuchando estos eventos:
- ✅ `checkout.session.completed` (ya configurado)

El webhook detecta automáticamente si es:
- **Suscripción** (`mode: subscription`) → Actualiza plan + otorga tokens del plan
- **Compra de tokens** (`mode: payment`) → Solo añade tokens, no toca el plan

---

## 🧪 Pruebas

### 1. Prueba de Compra de Tokens

1. Inicia sesión en tu app
2. Ve a la página de Facturación o haz clic en "Mejorar Plan"
3. Verás una nueva card "🪙 Compra Puntual - Tokens Extras"
4. Mueve el slider para seleccionar la cantidad de tokens
5. Haz clic en "Comprar Ahora"
6. Completa el pago con tarjeta de prueba: `4242 4242 4242 4242`
7. ✅ Verifica que los tokens se añadan a tu balance

### 2. Verificar en Supabase

```sql
-- Ver tu balance actual
SELECT balance FROM user_token_balances WHERE user_id = 'TU_USER_ID';

-- Ver últimas transacciones
SELECT * FROM user_token_ledger 
WHERE user_id = 'TU_USER_ID' 
ORDER BY created_at DESC 
LIMIT 5;

-- La compra de tokens debe aparecer con reason = 'token_purchase'
```

### 3. Verificar Webhook

En Stripe Dashboard → Webhooks → Events:
- Busca el evento `checkout.session.completed` de tu compra
- Verifica que el `mode` sea `payment` (no `subscription`)
- Verifica que en metadata aparezca `purchaseType: token_package`

---

## 🎨 Cambios en la UI

### ✅ Implementados

1. **Modal "Mejorar Plan":**
   - ✅ Quitado "Soporte Prioritario" de Starter
   - ✅ Añadidos ticks azules en lugar de "•"
   - ✅ Tokens mostrados al lado del tick (bold)
   - ✅ Añadidos segundos de video (10 tokens = 4 segundos)
   - ✅ Card de compra de tokens con slider
   - ✅ Badge "Más Popular" en Growth

2. **Modal "Cambiar Plan":**
   - ✅ Mismo diseño que "Mejorar Plan"
   - ✅ Ticks azules
   - ✅ Tokens al lado del tick
   - ✅ Segundos de video mostrados
   - ✅ **SIN** badge "Más Popular"
   - ✅ Card de compra de tokens con slider
   - ✅ Quitado "Soporte Prioritario" de Starter

3. **AppHeader:**
   - ✅ Balance de tokens visible arriba a la derecha
   - ✅ Entre "Tokens" y "Mejorar Plan"
   - ✅ Icono de moneda + número

4. **Dashboard:**
   - ✅ Quitado TokenCounter del dashboard

---

## 🔍 Comportamiento de Tokens

### Suscripciones (Planes Mensuales)
- **Al activar plan:** Se ACUMULAN los tokens del plan
- **Renovación mensual:** Se RESETEAN a la cantidad del plan
- **Cambio de plan:** Se ACUMULAN los tokens del nuevo plan

### Compras Puntuales (Token Packages)
- **Al comprar:** Se SUMAN al balance actual
- **No caducan:** Se mantienen indefinidamente
- **No afectan plan:** No se cancela ni cambia la suscripción

---

## 📊 Flujo Completo

```
Usuario en Plan Free (30 tokens)
    ↓
Compra 600 tokens → Balance: 630 tokens ✅
    ↓
Sube a Growth (1000 tokens/mes) → Balance: 1630 tokens ✅
    ↓
Usa 500 tokens → Balance: 1130 tokens
    ↓
Renovación mensual → Balance: 1000 tokens (reset a plan amount)
```

---

## 🐛 Troubleshooting

### "Price not configured"
➜ Verifica que las variables `STRIPE_PRICE_*TK` estén configuradas en `.env.local`

### "Webhook no procesa la compra"
1. Verifica en Stripe Dashboard → Webhooks → Events
2. Busca el evento `checkout.session.completed`
3. Revisa los logs del webhook
4. Asegúrate de que `mode` sea `payment`

### "Los tokens no se suman al balance"
1. Verifica en `stripe_webhook_events` si el evento se procesó
2. Ejecuta:
```sql
SELECT * FROM stripe_webhook_events 
WHERE type = 'checkout.session.completed' 
ORDER BY processed_at DESC 
LIMIT 5;
```
3. Si aparece como `failed`, revisa el campo `error`

---

## ✅ Checklist de Configuración

- [ ] Crear 6 productos en Stripe (100, 300, 600, 1200, 3000, 6000 tokens)
- [ ] Todos los productos son **one-time** (NO recurring)
- [ ] Copiar los 6 Price IDs
- [ ] Añadir las 6 variables `STRIPE_PRICE_*TK` a `.env.local`
- [ ] Si estás en producción, añadirlas también a Vercel
- [ ] Reiniciar el servidor de desarrollo
- [ ] Probar compra de tokens en modo test
- [ ] Verificar que los tokens se añadan correctamente
- [ ] Verificar que el webhook procese el evento

---

## 🚀 Deploy a Producción

### Stripe Producción

1. **Repetir PASO 1** en modo LIVE (no test):
   - https://dashboard.stripe.com/products
   - Crear los 6 productos con precios reales
   - Copiar los Price IDs de producción

2. **Actualizar variables en Vercel:**
   - Vercel Dashboard → Settings → Environment Variables
   - Actualizar `STRIPE_PRICE_*TK` con los IDs de producción
   - Aplicar a "Production"

3. **Webhook de producción:**
   - Ve a: https://dashboard.stripe.com/webhooks
   - Asegúrate de que el webhook apunte a: `https://TU_DOMINIO.com/api/webhooks/stripe`
   - Copia el **Signing secret** de producción
   - Actualiza `STRIPE_WEBHOOK_SECRET` en Vercel

---

## 📞 Soporte

Si algo no funciona:
1. Revisa los logs del webhook en Stripe Dashboard
2. Revisa la tabla `stripe_webhook_events` en Supabase
3. Verifica que todas las variables de entorno estén configuradas
4. Asegúrate de que el webhook esté activo y apuntando a la URL correcta

---

**Última actualización:** 2026-01-05  
**Versión:** 1.0.0  
**Estado:** ✅ Completado e Implementado

