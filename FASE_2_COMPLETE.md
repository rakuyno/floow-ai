# ✅ FASE 2 COMPLETADA: Plan v3 URLs & UI

## 📋 Cambios Implementados

### **Parte 1: URLs Canonical → `/app/*`** ✅

#### 1. Contenido de Billing Movido
- **Archivo:** `src/app/app/billing/page.tsx` (REESCRITO COMPLETO)
- **Cambios:**
  - Migrado todo el contenido de `/dashboard/billing`
  - Agregadas interfaces extendidas con `pending_plan_id` y `pending_effective_date`
  - UI completamente funcional bajo `/app/billing`

#### 2. Dashboard Billing → Redirect
- **Archivo:** `src/app/dashboard/billing/page.tsx` (SIMPLIFICADO)
- **Cambio:** Convertido a redirect simple a `/app/billing`
- **Preserva:** Query params (`?success=true`, etc.)

#### 3. URLs de Retorno Actualizadas
- **Archivos:**
  - `src/app/api/billing/checkout/route.ts`
  - `src/app/api/billing/portal/route.ts`
- **Cambios:**
  ```diff
  - success_url: '/dashboard/billing?success=true'
  + success_url: '/app/billing?success=true'
  
  - return_url: '/dashboard/billing'
  + return_url: '/app/billing'
  ```

---

### **Parte 2: UI de Billing Mejorada** ✅

#### Nuevas Características Implementadas:

**1. Botones Inteligentes** 🎯
```typescript
// Botones basados en plan actual:
- "Cambiar Plan" → Abre selector de upgrades/downgrades
- "Pasar a Free" → Cancela suscripción al final del periodo
- "Gestionar Método de Pago" → Abre Stripe Portal (solo para pago)
```

**2. Selector de Plan Dinámico** 📊
```typescript
// Muestra opciones inteligentes:
- Upgrades: Border verde, "Cambio inmediato + prorrateo"
- Downgrades: Border azul, "Aplicará en próxima renovación"
- Separados visualmente por categoría
```

**3. Alertas de Estado** 🔔
```typescript
// 3 tipos de alertas:
1. Post-checkout: "Pago procesado. Actualizando tu plan..." (verde + spinner)
2. Pending change: "Cambio programado a [Plan] para [fecha]" (azul)
3. Canceling: "Se cancelará el [fecha]. Seguirás teniendo acceso..." (amarillo)
```

**4. Polling Post-Checkout** ⏱️
```typescript
// Cuando llega ?success=true:
- Poll cada 2s durante 20s max
- Refresca datos automáticamente
- Limpia URL al finalizar
```

**5. Integración con `/api/billing/change-plan`** 🔗
```typescript
// Flujo unificado:
A) Free → Paid: redirige a checkout
B) Upgrade: inmediato en mismo flujo
C) Downgrade: programa para renovación
D) Free: cancela al final de periodo
```

**6. Separación del Portal** 🔐
```typescript
// Portal SOLO para:
- Gestionar método de pago
- Ver facturas
- Actualizar info de billing

// NO para cambiar plan (se hace en app)
```

---

## 📁 Archivos Modificados

### ✏️ Modificados (4)
1. ✅ `src/app/app/billing/page.tsx` - UI completa con botones inteligentes + polling
2. ✅ `src/app/dashboard/billing/page.tsx` - Redirect a `/app/billing`
3. ✅ `src/app/api/billing/checkout/route.ts` - URLs a `/app/billing`
4. ✅ `src/app/api/billing/portal/route.ts` - URL a `/app/billing`

### 🔍 No Modificados (compatibles)
- `src/components/AppHeader.tsx` - Ya apunta a `/app/billing` ✅
- `src/components/PricingModal.tsx` - Ya usa `/api/billing/checkout` ✅
- `src/app/api/billing/change-plan/route.ts` - Ya funcional ✅

---

## 🎨 UI/UX Improvements

### Antes vs Después

**Antes (Old):**
```
❌ Dos páginas idénticas (/dashboard y /app)
❌ Botón "Cambiar Plan" abre portal (no útil)
❌ "Cancelar" abre portal (confuso)
❌ Sin mostrar pending changes
❌ Sin polling post-checkout (requiere F5)
❌ Sin separación upgrade/downgrade
```

**Después (New):**
```
✅ Una sola página canonical: /app/billing
✅ Botón "Cambiar Plan" abre selector in-app
✅ Botón "Pasar a Free" cancela directamente
✅ Muestra pending changes con fecha
✅ Polling automático post-checkout
✅ Separación visual upgrade (verde) vs downgrade (azul)
✅ Portal SOLO para payment methods
```

---

## 🔄 Flujos de Usuario

### Flujo 1: Usuario Free → Starter
```
1. Ve en /app/billing → grid de planes disponibles
2. Click "Suscribirse" en Starter
3. handleChangePlan('starter')
4. POST /api/billing/change-plan → needsCheckout: true
5. Redirige a /api/billing/checkout
6. Stripe Checkout
7. Return a /app/billing?success=true
8. Polling 2s × 10 (20s max)
9. Webhook procesa → plan actualizado
10. UI muestra: plan=starter, tokens actualizados
```

### Flujo 2: Usuario Starter → Growth (Upgrade)
```
1. En /app/billing → Click "Cambiar Plan"
2. Selector muestra Growth en sección "Upgrades" (verde)
3. Click Growth
4. handleChangePlan('growth')
5. POST /api/billing/change-plan → action: 'upgraded'
6. SIN checkout, cambio inmediato
7. Webhook customer.subscription.updated sincroniza plan_id
8. UI muestra: "Plan actualizado inmediatamente"
9. Balance tokens no cambia (solo en renovación)
```

### Flujo 3: Usuario Growth → Starter (Downgrade)
```
1. En /app/billing → Click "Cambiar Plan"
2. Selector muestra Starter en sección "Downgrades" (azul)
3. Click Starter
4. handleChangePlan('starter')
5. POST /api/billing/change-plan → action: 'scheduled'
6. Stripe Schedule creado
7. DB: pending_plan_id=starter, pending_effective_date=current_period_end
8. UI muestra alerta azul: "Cambio programado a Starter para [fecha]"
9. En renovación → Schedule aplica cambio
10. Webhook sincroniza → limpia pending_plan_id
```

### Flujo 4: Usuario Growth → Free (Cancelación)
```
1. En /app/billing → Click "Pasar a Free"
2. handleChangePlan('free')
3. POST /api/billing/change-plan → action: 'canceling'
4. Stripe: cancel_at_period_end=true
5. DB: status=canceling, pending_plan_id=free
6. UI muestra alerta amarilla: "Se cancelará el [fecha]"
7. Usuario mantiene acceso hasta fecha
8. Al final del periodo → customer.subscription.deleted
9. Webhook resetea a free
```

---

## 🧪 Testing Manual

### Test 1: Verificar Redirect
```bash
1. Ir a: http://localhost:3000/dashboard/billing
2. ✅ Debe redirigir a: http://localhost:3000/app/billing
3. ✅ Preserva query: /dashboard/billing?success=true → /app/billing?success=true
```

### Test 2: Verificar UI de Billing
```bash
1. Ir a: http://localhost:3000/app/billing
2. ✅ Fondo claro (bg-gray-50 del layout)
3. ✅ Header visible con nombre de usuario
4. ✅ Si plan != free: ver botones "Cambiar Plan", "Pasar a Free", "Gestionar Método de Pago"
5. ✅ Si plan = free: ver grid de planes disponibles
```

### Test 3: Verificar Cambio de Plan
```bash
# Upgrade (Starter → Growth)
1. Usuario en Starter
2. Click "Cambiar Plan"
3. ✅ Selector muestra Growth en "Upgrades" (verde)
4. Click Growth
5. ✅ Mensaje: "Plan actualizado inmediatamente"
6. ✅ UI refresca, muestra Growth

# Downgrade (Growth → Starter)
1. Usuario en Growth
2. Click "Cambiar Plan"
3. ✅ Selector muestra Starter en "Downgrades" (azul)
4. Click Starter
5. ✅ Alerta azul: "Cambio programado para [fecha]"
6. ✅ Plan sigue mostrando Growth hasta renovación
```

### Test 4: Verificar Polling Post-Checkout
```bash
1. Free → Starter checkout
2. Completar pago
3. ✅ Redirect a /app/billing?success=true
4. ✅ Alerta verde con spinner: "Pago procesado. Actualizando..."
5. ✅ Cada 2s refresca datos (ver console logs)
6. ✅ Después de 20s: limpia URL a /app/billing
```

### Test 5: Verificar Portal Separado
```bash
1. Usuario con plan pagado
2. Click "Gestionar Método de Pago"
3. ✅ Abre Stripe Portal
4. ✅ Portal muestra: payment methods, invoices, cancel
5. ✅ NO muestra cambio de plan (se hace en app)
6. ✅ Return URL: /app/billing
```

---

## 📊 Estado Final

### URLs Canonical:
```
✅ /app/dashboard → Dashboard principal
✅ /app/billing → Billing (canonical)
✅ /app/new → Crear anuncio
✅ /dashboard/billing → Redirect a /app/billing (compat)
```

### Endpoints Activos:
```
✅ POST /api/billing/checkout → Crea checkout session
✅ POST /api/billing/portal → Crea portal session
✅ POST /api/billing/change-plan → Maneja upgrades/downgrades/cancel
✅ POST /api/webhooks/stripe → Sincroniza desde Stripe
```

### Features Nuevas:
```
✅ Botones inteligentes basados en plan
✅ Selector in-app de upgrades/downgrades
✅ Alertas de pending changes
✅ Polling post-checkout
✅ Portal separado (solo payment)
✅ Cancelación directa a free
```

---

## ✅ Checklist de Implementación

- [x] Mover contenido a `/app/billing`
- [x] Convertir `/dashboard/billing` a redirect
- [x] Actualizar URLs de retorno (`success_url`, `cancel_url`, `return_url`)
- [x] Agregar botones inteligentes
- [x] Agregar selector de planes
- [x] Mostrar pending changes
- [x] Implementar polling post-checkout
- [x] Separar portal para payment methods
- [x] Integrar con `/api/billing/change-plan`

---

## 🎯 Resultado Final

**URLs:** ✅ Consistentes bajo `/app/*`
**UI:** ✅ Botones útiles, no portal genérico
**Cambio de Plan:** ✅ Funciona con 1 sola suscripción
**Tokens:** ✅ No duplicados (gracias a Mini-Fix)
**UX:** ✅ Polling automático, alertas claras

**Estado:** 🎉 **COMPLETO - LISTO PARA TESTING**

---

**Próximo paso:** Testing manual de los flujos completos.
