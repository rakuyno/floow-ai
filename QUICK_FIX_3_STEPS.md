# ⚡ Solución Rápida en 3 Pasos

## 🎯 Tu Problema
Pagaste por Agency pero sigues en Growth con solo 290 tokens en lugar de 2790.

---

## ✅ PASO 1: Arreglar el Schema (30 segundos)

1. Ve a **Supabase → SQL Editor**
2. Haz clic en **"New query"**
3. Copia y pega **TODO** el contenido del archivo:
   ```
   supabase/migrations/20260105_fix_stripe_integration.sql
   ```
4. Haz clic en **"Run"**
5. ✅ Deberías ver: "Success. No rows returned"

---

## ✅ PASO 2: Verificar en Stripe (1 minuto)

1. Ve a: https://dashboard.stripe.com/test/customers
2. Busca: `cus_TdgCNMJjwjthpA`
3. Haz clic en la pestaña **"Subscriptions"**
4. **Anota el ID de la suscripción Agency** (ejemplo: `sub_1Sm9eFRrdOsS9PewXXXXXX`)
   - Si ves 2 suscripciones activas → **Cancela la de Growth**
   - Si solo ves Growth → Necesitarás crear una nueva (vuelve a intentar el pago)

---

## ✅ PASO 3: Recibir tus Tokens (2 minutos)

1. Abre el archivo: `supabase/migrations/20260105_manual_fix_user_account.sql`

2. Busca esta línea (~52):
   ```sql
   v_subscription_id := 'sub_XXXXXXXXXXXX';
   ```

3. Reemplázala con el ID real que copiaste en el PASO 2:
   ```sql
   v_subscription_id := 'sub_1Sm9eFRrdOsS9PewXXXXXX';  -- Tu ID real aquí
   ```

4. **QUITA** los comentarios `/*` (línea ~32) y `*/` (línea ~77)
   
   ANTES:
   ```sql
   /*
   v_subscription_id := 'sub_XXXXXXXXXXXX';
   ...todo el código...
   */
   ```
   
   DESPUÉS:
   ```sql
   v_subscription_id := 'sub_1Sm9eFRrdOsS9PewXXXXXX';
   ...todo el código...
   ```

5. Copia **TODO** el archivo modificado

6. Pégalo en **Supabase → SQL Editor** y haz clic en **"Run"**

7. ✅ Deberías ver:
   ```
   NOTICE: Plan agency has 2500 monthly tokens
   NOTICE: FIX APPLIED:
   NOTICE: - Updated plan to: agency
   NOTICE: - Granted 2500 tokens
   ```

---

## 🎉 ¡Listo!

Verifica que todo esté correcto:

```sql
-- Ejecuta esto en Supabase SQL Editor:

-- Ver tu plan (debe ser 'agency')
SELECT plan_id FROM user_subscriptions 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';

-- Ver tu balance (debe ser ~2790)
SELECT balance FROM user_token_balances 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';
```

---

## 🔄 Deploy a Producción

Si todo funciona en test, despliega los cambios:

```bash
git add .
git commit -m "fix: Sistema de pagos Stripe corregido"
git push
```

---

## ❓ ¿Algo Salió Mal?

Comparte:
1. Qué paso falló
2. El mensaje de error exacto
3. El resultado de ejecutar: `diagnostic_full_check.sql`

---

**Tiempo total:** ~5 minutos

