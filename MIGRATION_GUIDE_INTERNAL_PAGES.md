# 🚧 MIGRACIÓN DE PÁGINAS INTERNAS - Guía Paso a Paso

## Estado Actual

✅ **Core multi-mercado funcionando**
✅ **APIs actualizadas**
✅ **Landing pages localizadas** (`/[market]/page.tsx`)
⚠️ **Páginas internas** (`/app/*`) aún usan rutas legacy (sin market prefix)

## ¿Es Necesario Migrar?

**NO urgente** - Las páginas actuales seguirán funcionando. La migración es para:
- Mantener consistencia de rutas (`/us/app/...` vs `/app/...`)
- Permitir URLs de vuelta desde Stripe con market correcto
- Persistir el market en toda la sesión del usuario

**Puedes hacer esto gradualmente**, página por página.

---

## Opción 1: Migración Completa (Recomendado)

### Paso 1: Mover Estructura de Carpetas

```bash
# Mover todas las páginas app
mv src/app/app src/app/(markets)/[market]/app
```

### Paso 2: Actualizar Links y Redirects

En cada página movida, actualiza los Links:

**ANTES:**
```typescript
import Link from 'next/link'

<Link href="/app/dashboard">Dashboard</Link>
<Link href="/app/billing">Billing</Link>
```

**AHORA:**
```typescript
import Link from 'next/link'
import { useMarket } from '@/lib/hooks/useMarket'

const MyPage = () => {
    const market = useMarket()
    
    return (
        <>
            <Link href={`/${market}/app/dashboard`}>Dashboard</Link>
            <Link href={`/${market}/app/billing`}>Billing</Link>
        </>
    )
}
```

### Paso 3: Actualizar Router Pushes

**ANTES:**
```typescript
router.push('/app/dashboard')
```

**AHORA:**
```typescript
const market = useMarket()
router.push(`/${market}/app/dashboard`)
```

### Paso 4: Actualizar Auth Callback

En `src/app/auth/callback/route.ts`, redirige al market del usuario:

```typescript
import { normalizeMarket, MARKET_COOKIE_NAME } from '@/lib/market'

export async function GET(request: NextRequest) {
    // ... existing auth logic ...
    
    // Get market from cookie
    const marketCookie = request.cookies.get(MARKET_COOKIE_NAME)?.value
    const market = normalizeMarket(marketCookie)
    
    // Redirect to market-specific dashboard
    return NextResponse.redirect(new URL(`/${market}/app/dashboard`, request.url))
}
```

---

## Opción 2: Coexistencia (Temporal)

Mantén ambas rutas funcionando:

### Estructura:

```
src/app/
├── app/                    # Legacy (sin market)
│   ├── dashboard/
│   ├── billing/
│   └── ...
└── (markets)/
    └── [market]/
        ├── page.tsx        # Landing localizada
        └── app/            # Nueva estructura (con market)
            ├── dashboard/
            ├── billing/
            └── ...
```

### Ventajas:
- ✅ Usuarios existentes siguen usando `/app/*`
- ✅ Nuevos usuarios usan `/[market]/app/*`
- ✅ Migración sin prisa

### Desventajas:
- ⚠️ Duplicación de código (mantener 2 sets de páginas)
- ⚠️ Más difícil de mantener

---

## Páginas a Migrar (en orden de prioridad)

### 🔴 Alta Prioridad
1. `/app/billing` - Para que success URLs de Stripe funcionen con market
2. `/app/dashboard` - Landing principal post-login

### 🟡 Media Prioridad
3. `/app/new` - Crear nuevo proyecto
4. `/app/session/[id]/*` - Sesiones de trabajo

### 🟢 Baja Prioridad (pueden quedar sin market)
5. `/login` - Puede quedar en root
6. `/signup` - Puede quedar en root
7. `/app/billing-fix` - Endpoint interno/admin

---

## Ejemplo Completo: Migrar Dashboard

### 1. Crear Nuevo Archivo

```bash
mkdir -p src/app/(markets)/[market]/app/dashboard
cp src/app/app/dashboard/page.tsx src/app/(markets)/[market]/app/dashboard/page.tsx
```

### 2. Actualizar Código

**Archivo:** `src/app/(markets)/[market]/app/dashboard/page.tsx`

```typescript
'use client'

import { useMarket } from '@/lib/hooks/useMarket'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
    const market = useMarket()
    const router = useRouter()
    
    // ... tu lógica existente ...
    
    return (
        <div>
            {/* Actualizar todos los Links */}
            <Link href={`/${market}/app/billing`}>
                Billing
            </Link>
            
            <Link href={`/${market}/app/new`}>
                New Project
            </Link>
            
            {/* Actualizar router.push */}
            <button onClick={() => router.push(`/${market}/app/new`)}>
                Create New
            </button>
        </div>
    )
}
```

### 3. Probar

Visita:
- http://localhost:3000/us/app/dashboard
- http://localhost:3000/es/app/dashboard
- http://localhost:3000/mx/app/dashboard

### 4. (Opcional) Redirect Legacy

Si quieres redirigir la ruta antigua a la nueva:

**Archivo:** `src/app/app/dashboard/page.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_MARKET } from '@/lib/market'

export default function LegacyDashboard() {
    const router = useRouter()
    
    useEffect(() => {
        // Check if user has market cookie
        const marketCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('market='))
            ?.split('=')[1]
        
        const market = marketCookie || DEFAULT_MARKET
        
        // Redirect to new market-aware route
        router.replace(`/${market}/app/dashboard`)
    }, [router])
    
    return <div>Redirecting...</div>
}
```

---

## Ejemplo: Actualizar Auth Callback

**Archivo:** `src/app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { normalizeMarket, MARKET_COOKIE_NAME } from '@/lib/market'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = createClient()
        await supabase.auth.exchangeCodeForSession(code)
    }

    // Get market from cookie or default to 'us'
    const marketCookie = request.cookies.get(MARKET_COOKIE_NAME)?.value
    const market = normalizeMarket(marketCookie)

    // Redirect to market-specific dashboard
    return NextResponse.redirect(new URL(`/${market}/app/dashboard`, request.url))
}
```

---

## Checklist por Página

Para cada página que migres:

- [ ] Crear carpeta en `src/app/(markets)/[market]/...`
- [ ] Copiar/mover archivo
- [ ] Añadir `import { useMarket } from '@/lib/hooks/useMarket'`
- [ ] Actualizar todos los `Link href` con `/${market}/...`
- [ ] Actualizar todos los `router.push` con `/${market}/...`
- [ ] Actualizar llamadas API si envían market explícitamente
- [ ] Probar en `/us`, `/es`, `/mx`
- [ ] (Opcional) Crear redirect desde ruta legacy

---

## Automatizar con Script

Si tienes muchas páginas, puedes usar este script:

```bash
#!/bin/bash

# update-links.sh - Actualiza Links en archivos
# Uso: ./update-links.sh src/app/(markets)/[market]/app/dashboard/page.tsx

file=$1

# Backup
cp "$file" "$file.bak"

# Añadir import del hook si no existe
if ! grep -q "useMarket" "$file"; then
    sed -i "1 i\import { useMarket } from '@/lib/hooks/useMarket'" "$file"
fi

# Reemplazar links comunes
sed -i 's|href="/app/|href={`/${market}/app/|g' "$file"
sed -i 's|router.push("/app/|router.push(`/${market}/app/|g' "$file"

echo "Updated $file (backup at $file.bak)"
```

---

## Errores Comunes

### Error: useMarket() devuelve 'us' siempre

**Causa:** La página no está dentro de `[market]` route

**Solución:** Asegúrate de que esté en `src/app/(markets)/[market]/...`

### Error: Links no incluyen market

**Causa:** Olvidaste usar template literal

**Incorrecto:**
```typescript
<Link href="/${market}/app/billing">
```

**Correcto:**
```typescript
<Link href={`/${market}/app/billing`}>
```

### Error: Redirect loop

**Causa:** Estás redirigiendo a una ruta que a su vez redirige

**Solución:** Verifica que no haya redirects circulares

---

## Conclusión

La migración de páginas internas **NO es urgente**. El sistema multi-mercado está funcionando para las landing pages y APIs.

**Recomendación:**
1. Empieza por `/app/billing` y `/app/dashboard` (más críticos)
2. Migra otras páginas gradualmente
3. O mantén coexistencia mientras tanto

**¿Necesitas ayuda?** Revisa los ejemplos arriba o consulta el código de `src/app/(markets)/[market]/page.tsx` como referencia.

