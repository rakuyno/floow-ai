# Stripe Integration Documentation

## 📚 Documentación Completa

Esta carpeta contiene toda la documentación relacionada con la integración de Stripe.

---

## 🚀 Comienza Aquí

### Para Configuración Inicial:
**→ [`QUICK_START.md`](./QUICK_START.md)** - Setup en 5 minutos

### Para Setup Detallado:
**→ [`STRIPE_SETUP.md`](./STRIPE_SETUP.md)** - Guía completa de configuración

---

## 📖 Guías Disponibles

| Documento | Propósito | Cuándo Usar |
|-----------|-----------|-------------|
| **[QUICK_START.md](./QUICK_START.md)** | Setup rápido (5 min) | Primera vez configurando |
| **[STRIPE_SETUP.md](./STRIPE_SETUP.md)** | Guía completa de Stripe | Setup detallado, troubleshooting |
| **[ENV_VARIABLES.md](./ENV_VARIABLES.md)** | Variables de entorno | Configurando .env.local |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** | Testing y verificación | Probando la integración |
| **[DIFF_SUMMARY.md](./DIFF_SUMMARY.md)** | Resumen de cambios | Revisando qué se modificó |

---

## 🎯 Flujo Recomendado

### Primera Vez (Setup)
```
1. QUICK_START.md        → Setup básico (5 min)
2. ENV_VARIABLES.md      → Configurar variables
3. STRIPE_SETUP.md       → Configurar Stripe Dashboard
```

### Testing Local
```
1. IMPLEMENTATION_SUMMARY.md → Seguir pasos de testing
2. STRIPE_SETUP.md           → Local Testing con Stripe CLI
```

### Producción
```
1. STRIPE_SETUP.md           → Production Checklist
2. IMPLEMENTATION_SUMMARY.md → Verificación final
```

### Debugging
```
1. STRIPE_SETUP.md           → Monitoring & Logs
2. IMPLEMENTATION_SUMMARY.md → Troubleshooting + Queries útiles
```

---

## 🔍 Encuentra Rápidamente

### Configuración
- **Variables de entorno:** [`ENV_VARIABLES.md`](./ENV_VARIABLES.md)
- **Stripe Dashboard:** [`STRIPE_SETUP.md#stripe-dashboard-setup`](./STRIPE_SETUP.md)
- **Webhooks:** [`STRIPE_SETUP.md#configure-webhook-endpoint`](./STRIPE_SETUP.md)

### Testing
- **Setup rápido:** [`QUICK_START.md#5-test-rápido`](./QUICK_START.md)
- **Testing completo:** [`IMPLEMENTATION_SUMMARY.md#pasos-para-probar-en-local`](./IMPLEMENTATION_SUMMARY.md)
- **Idempotencia:** [`IMPLEMENTATION_SUMMARY.md#6-probar-idempotencia`](./IMPLEMENTATION_SUMMARY.md)

### Troubleshooting
- **Errores comunes:** [`STRIPE_SETUP.md#common-issues`](./STRIPE_SETUP.md)
- **Queries útiles:** [`IMPLEMENTATION_SUMMARY.md#queries-útiles-de-debugging`](./IMPLEMENTATION_SUMMARY.md)
- **Logs:** [`STRIPE_SETUP.md#monitoring--logs`](./STRIPE_SETUP.md)

### Código
- **Archivos modificados:** [`DIFF_SUMMARY.md#archivos-modificados`](./DIFF_SUMMARY.md)
- **Archivos nuevos:** [`DIFF_SUMMARY.md#archivos-nuevos`](./DIFF_SUMMARY.md)
- **Endpoints API:** [`STRIPE_SETUP.md#api-endpoints`](./STRIPE_SETUP.md)

---

## 🎓 Entender la Integración

### ¿Qué Hace Esta Integración?

La integración de Stripe maneja:
- ✅ Suscripciones mensuales recurrentes
- ✅ Sistema de tokens basado en planes
- ✅ Checkout seguro con Stripe
- ✅ Portal de billing para usuarios
- ✅ Webhooks con idempotencia (previene duplicados)
- ✅ Renovaciones automáticas mensuales
- ✅ Manejo de pagos fallidos

### Componentes Principales

```
Frontend (Next.js)
├── /dashboard/billing → Página principal de billing
├── /app/billing → Redirect a /dashboard/billing (legacy)
└── PricingModal → Modal de planes

API Routes
├── /api/billing/checkout → Crear checkout session
├── /api/billing/portal → Crear portal session
└── /api/webhooks/stripe → Procesar eventos de Stripe

Database (Supabase)
├── subscription_plans → Planes disponibles
├── user_subscriptions → Suscripciones de usuarios
├── user_token_balances → Balance actual de tokens
├── user_token_ledger → Historial de transacciones
└── stripe_webhook_events → Idempotencia (NUEVO ✨)

Stripe
├── Products & Prices → Planes configurados
├── Checkout Sessions → Proceso de pago
├── Billing Portal → Auto-servicio de usuarios
└── Webhooks → Eventos automáticos
```

### Flujo de Checkout

```
1. Usuario hace clic en "Upgrade"
   ↓
2. Frontend → POST /api/billing/checkout {planId: 'starter'}
   ↓
3. Backend crea Stripe Checkout Session
   ↓
4. Usuario redirigido a Stripe.com
   ↓
5. Usuario completa pago
   ↓
6. Stripe → POST /api/webhooks/stripe {event: 'checkout.session.completed'}
   ↓
7. Backend verifica idempotencia (NUEVO ✨)
   ↓
8. Backend asigna tokens al usuario
   ↓
9. Backend marca evento como procesado (NUEVO ✨)
   ↓
10. Usuario redirigido a /dashboard/billing?success=true
```

### ¿Qué es Idempotencia?

**Problema:** Stripe puede enviar el mismo webhook múltiples veces (retry, network issues, etc.)

**Solución:** Tabla `stripe_webhook_events` guarda qué eventos ya se procesaron

**Resultado:** Tokens nunca se duplican, incluso si el webhook llega 10 veces

**Ver más:** [`IMPLEMENTATION_SUMMARY.md#6-probar-idempotencia`](./IMPLEMENTATION_SUMMARY.md)

---

## 📊 Cambios Recientes

### Enero 2025 - Idempotencia de Webhooks

**Cambios implementados:**
- ✅ Tabla `stripe_webhook_events` para tracking
- ✅ Verificación de eventos duplicados
- ✅ Manejo de `invoice.payment_failed`
- ✅ Logs estructurados mejorados
- ✅ Redirect de `/app/billing` a `/dashboard/billing`

**Ver detalles:** [`DIFF_SUMMARY.md`](./DIFF_SUMMARY.md)

---

## 🛠️ Mantenimiento

### Limpieza de Eventos Antiguos

Los eventos webhook se guardan indefinidamente. Para limpiar eventos antiguos (90+ días):

```sql
SELECT cleanup_old_webhook_events();
```

Considera ejecutar esto mensualmente como job automatizado.

### Monitoreo Recomendado

Queries para ejecutar periódicamente:

```sql
-- Eventos fallidos (requieren atención)
SELECT * FROM stripe_webhook_events 
WHERE status = 'failed' 
ORDER BY processed_at DESC;

-- Usuarios con suscripciones past_due
SELECT u.email, s.status, s.current_period_end
FROM user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.status = 'past_due';

-- Actividad reciente de webhooks
SELECT type, COUNT(*), MAX(processed_at) as last_processed
FROM stripe_webhook_events
WHERE processed_at > now() - interval '7 days'
GROUP BY type;
```

---

## 📞 Soporte

### Errores de Stripe
1. Verifica **Stripe Dashboard > Developers > Webhooks**
2. Revisa logs de webhook delivery
3. Consulta [`STRIPE_SETUP.md#common-issues`](./STRIPE_SETUP.md)

### Errores de Código
1. Revisa logs del servidor (prefijo `[WEBHOOK]`)
2. Consulta [`IMPLEMENTATION_SUMMARY.md#troubleshooting-común`](./IMPLEMENTATION_SUMMARY.md)
3. Verifica queries útiles en [`IMPLEMENTATION_SUMMARY.md#queries-útiles`](./IMPLEMENTATION_SUMMARY.md)

### Errores de Base de Datos
1. Verifica que migraciones estén aplicadas
2. Consulta RLS policies si hay errores de permisos
3. Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurado

---

## ✅ Checklist de Producción

Antes de hacer deploy:

- [ ] Migración `20250118_stripe_webhook_idempotency.sql` aplicada
- [ ] Variables de entorno configuradas (ver `ENV_VARIABLES.md`)
- [ ] Webhook endpoint configurado en Stripe Dashboard
- [ ] Testing de idempotencia completado
- [ ] Checkout flow probado end-to-end
- [ ] Payment failure flow probado
- [ ] Logs monitoreados por 24h post-deploy
- [ ] Plan de rollback documentado

---

## 🔐 Seguridad

### Variables Sensibles

⚠️ **Nunca commitear:**
- `STRIPE_SECRET_KEY` (bypasses todo)
- `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- `STRIPE_WEBHOOK_SECRET` (verifica webhooks)

✅ **Puede ser público:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Webhook Verification

El webhook **SIEMPRE** verifica la firma de Stripe:

```typescript
event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
```

Si la firma no coincide → 400 Bad Request

### Database Access

Webhooks usan `SUPABASE_SERVICE_ROLE_KEY` para bypasear RLS porque:
- No hay usuario autenticado en contexto de webhook
- Stripe llama directamente desde sus servidores

---

## 📈 Métricas a Monitorear

### Salud de Webhooks
- Eventos procesados vs fallidos
- Latencia de procesamiento
- Eventos duplicados detectados (idempotencia)

### Salud de Negocio
- Nuevas suscripciones por día
- Churns (cancelaciones)
- Payment failures
- Revenue por plan

### Queries para Dashboards

Ver [`IMPLEMENTATION_SUMMARY.md#queries-útiles-de-debugging`](./IMPLEMENTATION_SUMMARY.md)

---

## 🗺️ Roadmap Futuro (Opcional)

Ideas para extender la integración:

- [ ] Prorated upgrades/downgrades
- [ ] Trial periods
- [ ] Cupones/descuentos
- [ ] Add-ons (comprar tokens extras)
- [ ] Facturación anual con descuento
- [ ] Multi-currency support
- [ ] Limpieza automática de `stripe_webhook_events`
- [ ] Dashboard interno de webhooks

---

**¿Tienes dudas?** Revisa primero:
1. [`QUICK_START.md`](./QUICK_START.md) - Troubleshooting básico
2. [`STRIPE_SETUP.md`](./STRIPE_SETUP.md) - Common Issues
3. [`IMPLEMENTATION_SUMMARY.md`](./IMPLEMENTATION_SUMMARY.md) - Debugging avanzado

---

**Última actualización:** Enero 2025
