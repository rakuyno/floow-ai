# 🌍 Sistema Multi-Mercado - Guía de Implementación

## ✅ IMPLEMENTACIÓN COMPLETADA

Se ha implementado un sistema multi-mercado completo usando **rutas (NO subdominios)** con redirección automática por país, idioma adaptado y moneda/precios coherentes con Stripe.

---

## 📋 RESUMEN DE LA IMPLEMENTACIÓN

### Mercados Soportados
- **US** (`/us`): USD, English (en)
- **ES** (`/es`): EUR, Spanish-Spain (es-ES)
- **MX** (`/mx`): MXN, Spanish-Mexico (es-MX)

### Archivos Creados/Modificados

#### ✅ Core Libraries
- `src/lib/market.ts` - Sistema central de mercados, detección de país, resolvers
- `src/lib/i18n.ts` - Traducciones y formateo de moneda por mercado
- `src/lib/stripe.ts` - Price IDs organizados por mercado
- `middleware.ts` - Georedirect automático + detección de bots

#### ✅ Routing
- `src/app/(markets)/[market]/layout.tsx` - Layout para rutas de mercado
- `src/app/(markets)/[market]/page.tsx` - Landing page localizada

#### ✅ API Endpoints (con soporte multi-mercado)
- `src/app/api/billing/checkout/route.ts` - Checkout con market detection
- `src/app/api/billing/change-plan/route.ts` - Cambio de plan con market support
- `src/app/api/billing/buy-tokens/route.ts` - Compra de tokens con market support
- `src/app/api/webhooks/stripe/route.ts` - Webhook actualizado

#### ✅ Documentación
- `ENV_CONFIG.md` - Variables de entorno necesarias

---

## 🔧 CONFIGURACIÓN REQUERIDA

### 1. Variables de Entorno

Necesitas configurar **36 variables** de Stripe Price IDs (12 por mercado):

```bash
# ============================================
# US Market (USD)
# ============================================
STRIPE_PRICE_FREE_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_US=price_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# ES Market (EUR)
# ============================================
STRIPE_PRICE_FREE_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_ES=price_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# MX Market (MXN)
# ============================================
STRIPE_PRICE_FREE_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_MX=price_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# LEGACY (Backward Compatibility - Opcional)
# ============================================
STRIPE_PRICE_FREE=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY=price_xxxxxxxxxxxxxxxxxxxxx
```

### 2. Crear Prices en Stripe Dashboard

Para cada plan (Starter, Growth, Agency):

1. Ve a **Stripe Dashboard > Products**
2. Crea o edita el producto del plan
3. Añade 3 precios (uno por moneda):
   - **USD** para US market
   - **EUR** para ES market
   - **MXN** para MX market
4. Copia los Price IDs (`price_xxx...`) y pégalos en tu archivo `.env`

**Ejemplo:**
- Starter USD: $49/mes → `price_1234567890abcdef`
- Starter EUR: €49/mes → `price_abcdef1234567890`
- Starter MXN: $899/mes → `price_fedcba0987654321`

### 3. Desplegar en Vercel/Railway

1. Copia **TODAS** las variables de `.env.local` a tu plataforma
2. Asegúrate de usar claves de **producción** (`sk_live_...`)
3. Configura el Webhook Secret correcto de producción

---

## 🚀 FUNCIONAMIENTO

### Redirección Automática

#### Entrada a Root (`/`)

```
Usuario en España → headers: x-vercel-ip-country=ES
  ↓
Middleware detecta país → ES
  ↓
Redirect 302 → /es
  ↓
Set cookie: market=es (90 días)
```

#### Próximas Visitas

```
Usuario vuelve a / con cookie market=mx
  ↓
Middleware lee cookie
  ↓
Redirect 302 → /mx (sin recalcular por país)
```

#### Bots/Crawlers

```
GoogleBot accede a /
  ↓
Middleware detecta User-Agent con "bot"
  ↓
NO redirect → renderiza "/" directamente
  ↓
SEO preserved ✓
```

### Market Detection en APIs

Los endpoints de Stripe ahora detectan el market automáticamente:

1. **Parámetro explícito**: `{ market: "es" }` en body
2. **Referer header**: Extrae de path `/es/billing`
3. **Cookie**: Lee `market=mx`
4. **Default**: US si no hay nada

---

## 🔍 TESTING

### Casos de Prueba Críticos

```bash
# 1. España → /es
curl -H "x-vercel-ip-country: ES" https://example.com/ -I
# Expect: 302 → /es + Set-Cookie: market=es

# 2. México → /mx
curl -H "x-vercel-ip-country: MX" https://example.com/ -I
# Expect: 302 → /mx + Set-Cookie: market=mx

# 3. USA → /us
curl -H "x-vercel-ip-country: US" https://example.com/ -I
# Expect: 302 → /us + Set-Cookie: market=us

# 4. País no soportado (ej: Francia) → /us
curl -H "x-vercel-ip-country: FR" https://example.com/ -I
# Expect: 302 → /us + Set-Cookie: market=us

# 5. Con cookie → respeta cookie
curl -H "Cookie: market=mx" https://example.com/ -I
# Expect: 302 → /mx (no recalcula por país)

# 6. Bot → NO redirect
curl -H "User-Agent: GoogleBot" https://example.com/ -I
# Expect: 200 (sin redirect)

# 7. Rutas de mercado → NO redirect
curl https://example.com/es
# Expect: 200 (renderiza /es)

# 8. Assets → NO redirect
curl https://example.com/_next/static/xxx.js
curl https://example.com/favicon.ico
# Expect: 200 (sin middleware)
```

### Validar Stripe Integration

```typescript
// En consola de navegador (cuando estés en /es):
fetch('/api/billing/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'starter' })
})
.then(r => r.json())
.then(console.log)

// Debe usar STRIPE_PRICE_STARTER_ES (EUR)
```

---

## 🛠️ PRÓXIMOS PASOS (Pendientes)

### 1. Migrar Páginas de App

Las páginas actuales en `src/app/app/*` deben moverse a `src/app/(markets)/[market]/app/*`:

```
src/app/app/dashboard/page.tsx
  ↓ mover a ↓
src/app/(markets)/[market]/app/dashboard/page.tsx
```

**Cambios necesarios en cada página:**

```typescript
// Antes:
router.push('/app/billing')

// Ahora:
const params = useParams()
const market = params?.market as Market
router.push(`/${market}/app/billing`)
```

### 2. Actualizar Auth Pages

Crear versiones localizadas de:
- `src/app/(markets)/[market]/login/page.tsx`
- `src/app/(markets)/[market]/signup/page.tsx`

Con traducciones de textos según market.

### 3. Actualizar Componentes

Componentes como `PricingModal.tsx` necesitan:

```typescript
// Añadir prop market
interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlanId?: string
  market: Market // ← NUEVO
}

// Usar formatCurrency del mercado
import { formatCurrency } from '@/lib/i18n'
const price = formatCurrency(plan.monthly_price_cents / 100, market)
```

### 4. Database: Añadir Campo Market

**Opcional pero recomendado** para persistencia:

```sql
-- Añadir columna market a profiles/users
ALTER TABLE profiles ADD COLUMN market TEXT DEFAULT 'us';

-- Crear índice
CREATE INDEX idx_profiles_market ON profiles(market);
```

Al signup/login:
```typescript
await supabase
  .from('profiles')
  .update({ market })
  .eq('id', user.id)
```

---

## ⚠️ IMPORTANTE: NO ROMPER

### Rutas que NO deben cambiar (sin market prefix)

```
/api/*           → APIs siguen sin prefix
/auth/callback   → Auth callback sin prefix (Supabase lo requiere así)
/_next/*         → Next.js internals
/favicon.ico     → Assets estáticos
```

### Backward Compatibility

El sistema incluye **fallback a precios legacy EUR** si faltan variables:

```typescript
// Si STRIPE_PRICE_STARTER_MX no existe, usa STRIPE_PRICE_STARTER
// Se loguea warning en consola para que lo detectes
```

---

## 📊 CHECKLIST DE DEPLOYMENT

Antes de desplegar a producción:

- [ ] Crear los 36 Stripe Prices (12 por mercado)
- [ ] Configurar todas las env vars en Vercel/Railway
- [ ] Usar `sk_live_...` y webhook secret de producción
- [ ] Probar los 8 casos de testing listados arriba
- [ ] Verificar que bots NO son redirigidos (usar curl)
- [ ] Confirmar que `/es`, `/mx`, `/us` renderizan correctamente
- [ ] Verificar Stripe checkout usa moneda correcta
- [ ] Comprobar que webhook procesa eventos correctamente
- [ ] Migrar páginas internas a estructura `[market]`
- [ ] Actualizar todos los Links/redirects con `/${market}/...`
- [ ] (Opcional) Añadir campo `market` en DB profiles

---

## 🎯 VENTAJAS DE ESTA IMPLEMENTACIÓN

✅ **Sin subdominios**: Todo en un solo dominio (mejor para SEO)
✅ **Sin selector UI**: Detección automática transparente
✅ **Sin loops**: Lógica clara de prioridad (path > cookie > geo > default)
✅ **SEO-friendly**: Bots ven la landing normal sin redirects
✅ **Stripe coherente**: Cada mercado cobra en su moneda
✅ **Cookie persistence**: Usuario mantiene su market elegido
✅ **Fallback inteligente**: Países no soportados → US market
✅ **Type-safe**: Todo tipado con TypeScript
✅ **Edge-optimized**: Middleware corre en edge (rápido)

---

## 🐛 TROUBLESHOOTING

### "Price not configured" en checkout

**Causa**: Falta env var `STRIPE_PRICE_xxx_YY`

**Solución**: 
1. Revisa consola: verás warning con variable faltante
2. Añade variable en `.env` o Vercel
3. Redeploy

### Usuario queda en market incorrecto

**Causa**: Cookie corrupta o navegador con extensiones

**Solución**:
```javascript
// Borrar cookie y forzar redirect
document.cookie = 'market=; max-age=0'
window.location.href = '/'
```

### Bots son redirigidos (malo para SEO)

**Causa**: User-Agent no detectado como bot

**Solución**: Añadir patrón en `src/lib/market.ts`:
```typescript
const botPatterns = [
  // ... existentes ...
  'tu_nuevo_bot_pattern'
]
```

### Webhook falla con market unknown

**Causa**: Checkout session no tiene metadata.market

**Solución**: Asegura que el frontend pasa `market` al crear checkout:
```typescript
fetch('/api/billing/checkout', {
  body: JSON.stringify({ planId: 'starter', market })
})
```

---

## 📝 LOGS ÚTILES

Busca estos logs en producción para diagnosticar:

```
[STRIPE CHECKOUT] Market detected: es for plan: starter
[BILLING] Market detected: mx
[WEBHOOK] Processing event evt_xxx
```

Si ves warnings de "Missing price ID", faltan env vars.

---

## 🎉 RESULTADO FINAL

Usuarios de diferentes países acceden automáticamente a su mercado:

- 🇪🇸 **España**: `example.com/es` → Precios en EUR, idioma Español-España
- 🇲🇽 **México**: `example.com/mx` → Precios en MXN, idioma Español-México
- 🇺🇸 **USA**: `example.com/us` → Precios en USD, idioma English
- 🌍 **Otros**: `example.com/us` → Default a USD, idioma English

Todo invisible para el usuario, sin selectors, sin subdominios, sin loops.

---

**Implementado por**: AI Senior Full-Stack Engineer
**Fecha**: Enero 2026
**Estado**: ✅ Core completado, pendiente migración de páginas internas

