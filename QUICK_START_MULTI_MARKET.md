# 🚀 Guía Rápida: Sistema Multi-Mercado

## ✅ ¿Qué se ha implementado?

Un sistema completo de multi-mercado que detecta automáticamente el país del usuario y lo redirige a su mercado correcto (US/ES/MX) con precios y moneda adaptados a Stripe.

---

## 📝 PARA EMPEZAR AHORA

### 1. Configurar Variables de Entorno

Crea o actualiza tu archivo `.env.local`:

```bash
# Copia estas variables y reemplaza con tus Stripe Price IDs reales

# US Market (USD)
STRIPE_PRICE_FREE_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_US=price_xxxxxxxxxxxxxxxxxxxxx

# ES Market (EUR)
STRIPE_PRICE_FREE_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_ES=price_xxxxxxxxxxxxxxxxxxxxx

# MX Market (MXN)
STRIPE_PRICE_FREE_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_MX=price_xxxxxxxxxxxxxxxxxxxxx

# Backward compatibility (opcional)
STRIPE_PRICE_FREE=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY=price_xxxxxxxxxxxxxxxxxxxxx
```

### 2. Probar Localmente

```bash
npm run dev
```

Abre:
- http://localhost:3000/ → Redirige a `/us` (o tu país)
- http://localhost:3000/es → Página en español con precios EUR
- http://localhost:3000/mx → Página en español con precios MXN
- http://localhost:3000/us → Página en inglés con precios USD

---

## 🛠️ CÓMO USAR EN TU CÓDIGO

### En Páginas o Componentes

```typescript
// app/(markets)/[market]/mi-pagina/page.tsx
import { useMarket, useTranslations } from '@/lib/hooks/useMarket'
import { formatCurrency } from '@/lib/i18n'

export default function MiPagina() {
    const market = useMarket() // 'us' | 'es' | 'mx'
    const t = useTranslations() // Textos localizados
    
    const precio = formatCurrency(49, market) // "$49" o "€49" o "$49 MXN"
    
    return (
        <div>
            <h1>{t.nav.features}</h1>
            <p>Precio: {precio}</p>
        </div>
    )
}
```

### En Redirects y Links

```typescript
import { useMarket } from '@/lib/hooks/useMarket'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function MiComponente() {
    const market = useMarket()
    const router = useRouter()
    
    return (
        <>
            {/* Con Link */}
            <Link href={`/${market}/app/dashboard`}>Dashboard</Link>
            
            {/* Con router.push */}
            <button onClick={() => router.push(`/${market}/login`)}>
                Login
            </button>
        </>
    )
}
```

### Llamadas a API de Stripe

```typescript
// El market se detecta automáticamente, pero puedes enviarlo explícitamente
const market = useMarket()

const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        planId: 'starter',
        market // Opcional, se detecta auto si no se envía
    })
})
```

---

## 📂 PRÓXIMOS PASOS (Migración)

### Páginas Pendientes de Migrar

Las páginas en `src/app/app/*` deben moverse a `src/app/(markets)/[market]/app/*`:

```
ANTES:
src/app/app/dashboard/page.tsx

AHORA:
src/app/(markets)/[market]/app/dashboard/page.tsx
```

### Login y Signup

Crea versiones localizadas:

```
src/app/(markets)/[market]/login/page.tsx
src/app/(markets)/[market]/signup/page.tsx
```

Usa el hook `useTranslations()` para textos localizados.

---

## 🧪 TESTING

### Simular Países (Local)

Como no tienes headers de Vercel localmente, visita directamente:

- http://localhost:3000/es
- http://localhost:3000/mx
- http://localhost:3000/us

### Probar Detección Automática (Producción)

Una vez deployed en Vercel:

```bash
# España → /es
curl -H "x-vercel-ip-country: ES" https://tu-app.vercel.app/ -I

# México → /mx
curl -H "x-vercel-ip-country: MX" https://tu-app.vercel.app/ -I

# Francia (no soportado) → /us
curl -H "x-vercel-ip-country: FR" https://tu-app.vercel.app/ -I
```

### Verificar Stripe

1. Ve a `/es` y crea checkout
2. Verifica en Stripe Dashboard que el precio es en EUR
3. Repite para `/mx` (MXN) y `/us` (USD)

---

## 🎨 PERSONALIZAR TEXTOS

Edita `src/lib/i18n.ts`:

```typescript
const ES_ES_TRANSLATIONS: Translations = {
    nav: {
        features: 'Mis Features', // ← Cambia esto
        pricing: 'Mis Precios',
        // ...
    }
}
```

Añade nuevas claves:

```typescript
export interface Translations {
    // ... existentes ...
    myNewSection: {
        title: string
        subtitle: string
    }
}

// Luego en EN/ES/MX:
myNewSection: {
    title: 'My Title',
    subtitle: 'My Subtitle'
}
```

Usa en componentes:

```typescript
const t = useTranslations()
<h1>{t.myNewSection.title}</h1>
```

---

## ⚙️ DESPLIEGUE A PRODUCCIÓN

### Vercel

1. Ve a Settings > Environment Variables
2. Añade las 36 variables `STRIPE_PRICE_*_US/ES/MX`
3. Usa claves de producción: `sk_live_...`
4. Configura webhook secret de producción
5. Redeploy

### Railway / Render

Igual que Vercel: añadir todas las env vars en su panel.

---

## 🔍 DEBUGGING

### Ver Market Detectado

```typescript
const market = useMarket()
console.log('Current market:', market)
```

### Ver Cookies

Abre DevTools > Application > Cookies > `market`

Debe ser `us`, `es`, o `mx`.

### Logs de API

En producción, revisa logs de Vercel:

```
[STRIPE CHECKOUT] Market detected: es for plan: starter
[BILLING] Market detected: mx
```

Si ves "Price not configured", te falta una env var.

---

## 🎯 RESULTADO ESPERADO

### Usuario en España

1. Visita `https://tu-app.com/`
2. Detecta país = ES
3. Redirect a `/es`
4. Cookie `market=es` guardada
5. Ve precios en EUR (€49/mes)
6. Textos en español-España
7. Stripe cobra en EUR

### Usuario en México

1. Visita `https://tu-app.com/`
2. Detecta país = MX
3. Redirect a `/mx`
4. Cookie `market=mx` guardada
5. Ve precios en MXN ($899/mes)
6. Textos en español-México
7. Stripe cobra en MXN

### Usuario en USA

1. Visita `https://tu-app.com/`
2. Detecta país = US
3. Redirect a `/us`
4. Cookie `market=us` guardada
5. Ve precios en USD ($49/mes)
6. Textos en inglés
7. Stripe cobra en USD

---

## 📚 ARCHIVOS IMPORTANTES

```
src/lib/market.ts         → Core del sistema de mercados
src/lib/i18n.ts           → Traducciones y formateo de moneda
src/lib/stripe.ts         → Price IDs por mercado
src/lib/hooks/useMarket.ts → Hooks para componentes
middleware.ts             → Georedirect automático
```

---

## ❓ FAQ

**P: ¿Puedo cambiar los mercados soportados?**
R: Sí, edita `VALID_MARKETS` en `src/lib/market.ts`.

**P: ¿Cómo añadir más idiomas?**
R: Añade locale en `MARKET_CONFIG` y traducciones en `src/lib/i18n.ts`.

**P: ¿Los usuarios pueden cambiar de market manualmente?**
R: No implementado. El market se decide por geo + cookie. Para implementarlo, añade un selector y actualiza la cookie.

**P: ¿Funciona sin las env vars?**
R: Sí, usa fallback a precios EUR legacy, pero logueará warnings.

**P: ¿Afecta al SEO?**
R: No. Bots no son redirigidos, ven el root `/` normalmente.

---

## ✅ CHECKLIST DE MIGRACIÓN

- [x] Core multi-market implementado
- [x] Middleware con georedirect
- [x] APIs de Stripe actualizadas
- [x] Componente PricingModal actualizado
- [x] Landing page localizada en `/[market]`
- [ ] Migrar páginas de `/app/*` a `/[market]/app/*`
- [ ] Crear `/[market]/login` y `/[market]/signup`
- [ ] Actualizar todos los Links con `/${market}/...`
- [ ] (Opcional) Añadir campo `market` en DB profiles
- [ ] Configurar env vars en producción
- [ ] Probar casos de testing en producción

---

**¿Necesitas ayuda?** Revisa `MULTI_MARKET_IMPLEMENTATION.md` para documentación detallada.

**Listo para usar**: El sistema está funcional. Solo falta configurar env vars y migrar páginas internas.

