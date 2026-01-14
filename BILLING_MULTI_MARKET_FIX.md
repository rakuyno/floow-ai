# Fix: Sistema de Facturación Multi-Mercado

## Problema Detectado

El sistema de pagos tenía problemas después de implementar el soporte multi-mercado porque:

1. **La página de billing NO enviaba el market** al cambiar de plan
2. **Los price IDs de Stripe no estaban configurados** para todos los mercados
3. **Símbolos de moneda hardcodeados** en euros (€) en lugar de adaptarse al mercado

## Cambios Realizados

### 1. Arreglada la página de billing (`src/app/app/billing/page.tsx`)

✅ Ahora envía el `market` al cambiar de plan  
✅ Usa `formatCurrency()` para mostrar precios con la moneda correcta  
✅ Incluye logging para debugging

### 2. Mejor manejo de errores en la API (`src/app/api/billing/change-plan/route.ts`)

✅ Logging mejorado para identificar qué price ID falta  
✅ Mensajes de error más claros que indican qué variable de entorno falta

## Siguiente Paso: Configurar Price IDs en Stripe

### Variables de Entorno Requeridas

Para que el sistema funcione correctamente, necesitas configurar estos Price IDs en Stripe Dashboard:

#### US Market (USD - $)
```env
STRIPE_PRICE_STARTER_US_MONTHLY=price_xxx...
STRIPE_PRICE_STARTER_US_ANNUAL=price_xxx...
STRIPE_PRICE_GROWTH_US_MONTHLY=price_xxx...
STRIPE_PRICE_GROWTH_US_ANNUAL=price_xxx...
STRIPE_PRICE_AGENCY_US_MONTHLY=price_xxx...
STRIPE_PRICE_AGENCY_US_ANNUAL=price_xxx...
```

#### ES Market (EUR - €)
```env
STRIPE_PRICE_STARTER_ES_MONTHLY=price_xxx...
STRIPE_PRICE_STARTER_ES_ANNUAL=price_xxx...
STRIPE_PRICE_GROWTH_ES_MONTHLY=price_xxx...
STRIPE_PRICE_GROWTH_ES_ANNUAL=price_xxx...
STRIPE_PRICE_AGENCY_ES_MONTHLY=price_xxx...
STRIPE_PRICE_AGENCY_ES_ANNUAL=price_xxx...
```

#### MX Market (MXN - $)
```env
STRIPE_PRICE_STARTER_MX_MONTHLY=price_xxx...
STRIPE_PRICE_STARTER_MX_ANNUAL=price_xxx...
STRIPE_PRICE_GROWTH_MX_MONTHLY=price_xxx...
STRIPE_PRICE_GROWTH_MX_ANNUAL=price_xxx...
STRIPE_PRICE_AGENCY_MX_MONTHLY=price_xxx...
STRIPE_PRICE_AGENCY_MX_ANNUAL=price_xxx...
```

### Cómo Crear los Price IDs en Stripe

1. **Ve a Stripe Dashboard** → Products
2. **Crea o edita cada producto** (Starter, Growth, Agency)
3. **Añade precios** para cada combinación:
   - Mercado (US/ES/MX)
   - Moneda (USD/EUR/MXN)
   - Intervalo (Monthly/Annual)

#### Precios por Plan y Mercado

**US (USD):**
- Starter: $45/mes o $450/año
- Growth: $99/mes o $990/año
- Agency: $249/mes o $2490/año

**ES (EUR):**
- Starter: €39/mes o €390/año
- Growth: €99/mes o €990/año
- Agency: €229/mes o €2229/año

**MX (MXN):**
- Starter: $795/mes o $7950/año
- Growth: $1995/mes o $19950/año
- Agency: $4495/mes o $44950/año

### Verificar Configuración Actual

Puedes verificar qué price IDs están configurados ejecutando:

```bash
# En tu consola de logs (vercel/railway)
# Busca mensajes como:
[Stripe Config] Validating subscription price IDs...
[Stripe Config] Missing: STRIPE_PRICE_STARTER_ES_MONTHLY
[Stripe Config] Missing: STRIPE_PRICE_STARTER_ES_ANNUAL
```

## Debugging

### 1. Para verificar qué mercado se está detectando:

Abre la consola del navegador y verás logs como:
```
[Billing] Changing plan to: starter market: es
[BILLING] Market detected: es Interval: monthly
```

### 2. Para verificar si el price ID existe:

En los logs del servidor verás:
```
[BILLING] ✅ Found price ID: price_1ABC...
```

O si falta:
```
[BILLING] ❌ No price ID configured for market: es plan: starter interval: monthly
```

## Solución Temporal

Si no tienes todos los price IDs configurados, el sistema intentará usar los **legacy price IDs** (solo mensuales):

```env
STRIPE_PRICE_STARTER=price_xxx...
STRIPE_PRICE_GROWTH=price_xxx...
STRIPE_PRICE_AGENCY=price_xxx...
```

⚠️ **NOTA:** Los legacy prices solo funcionan para planes mensuales y no distinguen entre mercados.

## Problema Específico del Usuario

El error **"The price specified is inactive"** significa que:

1. ✅ El mercado SÍ se está detectando correctamente (porque Growth funciona)
2. ❌ El price ID de Starter NO está configurado O está inactivo en Stripe

### Para solucionarlo:

1. Verifica en Stripe Dashboard que el precio de Starter esté **ACTIVO**
2. Copia el Price ID correcto y actualiza la variable de entorno correspondiente
3. Reinicia tu aplicación para que tome los nuevos valores

## Downgrade a FREE

El downgrade a FREE debería funcionar correctamente ahora. Si "nada sucede":

1. Abre la consola del navegador y busca errores
2. Verifica los logs del servidor
3. Asegúrate de que el botón esté habilitado (no debería estar deshabilitado si estás en un plan de pago)

El sistema ahora:
- ✅ Cancela la suscripción en Stripe inmediatamente
- ✅ Actualiza la base de datos a 'free'
- ✅ Muestra un alert de confirmación
- ✅ Refresca los datos automáticamente
