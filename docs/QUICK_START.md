# Stripe Integration - Quick Start Guide

## 🚀 Setup en 5 Minutos

### 1. Aplicar Migración (1 min)

**Opción A - Supabase CLI:**
```bash
cd c:\Users\Usuario\Desktop\floow
supabase db push
```

**Opción B - Supabase Dashboard:**
1. Abre [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a SQL Editor
3. Copia y pega `supabase/migrations/20250118_stripe_webhook_idempotency.sql`
4. Ejecuta

**Verificar:**
```sql
SELECT COUNT(*) FROM stripe_webhook_events;
-- Debe retornar 0 (tabla vacía pero existe)
```

---

### 2. Configurar Stripe CLI (2 min)

```bash
# Instalar (si no lo tienes)
# Windows: scoop install stripe
# macOS: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Copia el webhook secret** que se muestra (empieza con `whsec_...`)

---

### 3. Actualizar .env.local (1 min)

Crea o actualiza `c:\Users\Usuario\Desktop\floow\.env.local`:

```bash
# Pega el webhook secret del paso anterior
STRIPE_WEBHOOK_SECRET=whsec_...

# Las demás variables deberían ya estar configuradas:
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_AGENCY=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

### 4. Iniciar Servidor (30 seg)

```bash
npm run dev
```

Terminal debe mostrar:
```
✓ Ready in X ms
○ Local:   http://localhost:3000
```

**No cierres la terminal del Stripe CLI** (debe seguir corriendo en paralelo)

---

### 5. Test Rápido (1 min)

#### A. Test de Redirect
1. Abre: `http://localhost:3000/app/billing`
2. Deberías ser redirigido a: `http://localhost:3000/dashboard/billing`
3. ✅ Si redirige → funcionando

#### B. Test de Idempotencia (trigger rápido)
```bash
# En otra terminal (con Stripe CLI activo)
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed  # Mismo evento 2x
```

**Verificar logs del servidor:**
```
Primera ejecución:
[WEBHOOK] Processing event evt_...
[WEBHOOK] Event evt_... marked as processed

Segunda ejecución:
[WEBHOOK] Event evt_... already processed, skipping.  ← ✅ ESTO ES CORRECTO
```

**Verificar en Supabase:**
```sql
SELECT * FROM stripe_webhook_events ORDER BY processed_at DESC LIMIT 1;
-- Debe mostrar el evento recién procesado
```

---

## ✅ ¿Funcionó Todo?

Si ves estos resultados, la integración está lista:

- [x] Migración aplicada sin errores
- [x] Stripe CLI conectado y mostrando eventos
- [x] Redirect funciona de `/app/billing` a `/dashboard/billing`
- [x] Webhook procesa eventos
- [x] Idempotencia funciona (segundo evento se salta)
- [x] Tabla `stripe_webhook_events` tiene registros

---

## 🐛 ¿Algo No Funciona?

### Error: "relation 'stripe_webhook_events' does not exist"

**Solución:** Migración no aplicada. Vuelve al paso 1.

### Error: "No signatures found matching..."

**Solución:** `STRIPE_WEBHOOK_SECRET` incorrecto. Copia el secret del `stripe listen`.

### Webhook no llega / timeout

**Solución:** 
1. Verifica que `stripe listen` esté corriendo
2. Verifica que el puerto 3000 esté libre
3. Reinicia ambos servidores (Next.js y Stripe CLI)

### Evento se procesa dos veces

**Solución:**
1. Verifica que la migración se aplicó correctamente
2. Verifica logs: debe decir "already processed, skipping" en segundo intento
3. Si no, consulta `docs/IMPLEMENTATION_SUMMARY.md` → Troubleshooting

---

## 📚 Próximos Pasos

### Testing Completo
Ver: `docs/IMPLEMENTATION_SUMMARY.md` → Sección "Pasos para Probar en Local"

### Testing de Checkout Real
1. Ve a `http://localhost:3000/dashboard/billing`
2. Haz clic en "Upgrade" en cualquier plan
3. Usa tarjeta de prueba: `4242 4242 4242 4242`
4. Completa checkout
5. Verifica tokens asignados en base de datos

### Configuración para Producción
Ver: `docs/STRIPE_SETUP.md` → Sección "Production Checklist"

---

## 🆘 Necesitas Ayuda?

1. **Logs detallados:** `docs/IMPLEMENTATION_SUMMARY.md` → Troubleshooting
2. **Setup completo:** `docs/STRIPE_SETUP.md`
3. **Queries útiles:** `docs/IMPLEMENTATION_SUMMARY.md` → "Queries Útiles"
4. **Diffs de código:** `docs/DIFF_SUMMARY.md`

---

## 📊 Status Check Rápido

Ejecuta estos comandos para verificar el estado:

```sql
-- Ver si migración está aplicada
SELECT COUNT(*) FROM stripe_webhook_events;

-- Ver últimos eventos procesados
SELECT id, type, status, processed_at 
FROM stripe_webhook_events 
ORDER BY processed_at DESC 
LIMIT 5;

-- Ver si hay eventos fallidos
SELECT * FROM stripe_webhook_events WHERE status = 'failed';

-- Ver balance de tokens de usuario de prueba
SELECT u.email, b.balance 
FROM user_token_balances b
JOIN auth.users u ON u.id = b.user_id
LIMIT 5;
```

---

**¡Listo! Tu integración de Stripe con idempotencia está configurada. 🎉**

Para testing avanzado y producción, consulta la documentación completa en `/docs/`.
