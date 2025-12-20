# Stripe Integration Setup Guide

## Overview

This project uses Stripe for subscription billing with a token-based system. The integration includes:

- ✅ Checkout sessions for new subscriptions
- ✅ Billing portal for managing subscriptions
- ✅ Webhooks with idempotency protection
- ✅ Automatic token allocation on subscription events

---

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...              # Get from Stripe Dashboard > API Keys
STRIPE_WEBHOOK_SECRET=whsec_...            # Get from Stripe Dashboard > Webhooks

# Stripe Price IDs (create these in Stripe Dashboard > Products)
STRIPE_PRICE_FREE=                         # Optional: if free plan has a price ID
STRIPE_PRICE_STARTER=price_...             # Required
STRIPE_PRICE_GROWTH=price_...              # Required
STRIPE_PRICE_AGENCY=price_...              # Required

# Supabase (required for webhooks)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # Required for webhook database access

# App URL (for checkout redirects)
NEXT_PUBLIC_APP_URL=https://yourdomain.com # Or http://localhost:3000 for dev
```

---

## Stripe Dashboard Setup

### 1. Create Products & Prices

Go to **Stripe Dashboard > Products** and create:

| Plan    | Price (EUR/month) | Tokens | Description          |
|---------|-------------------|--------|----------------------|
| Starter | €29.00            | 300    | Starter plan         |
| Growth  | €79.00            | 1,000  | Growth plan          |
| Agency  | €199.00           | 2,500  | Agency/Scale plan    |

**Note:** Free plan (30 tokens) is created automatically on user signup.

For each product:
1. Click "Add product"
2. Set name and price
3. Select "Recurring" → "Monthly"
4. Copy the Price ID (starts with `price_...`)
5. Add to your `.env.local` as `STRIPE_PRICE_*`

### 2. Configure Webhook Endpoint

Go to **Stripe Dashboard > Developers > Webhooks**:

1. Click **"Add endpoint"**
2. Set endpoint URL:
   - **Production:** `https://yourdomain.com/api/webhooks/stripe`
   - **Development:** Use [Stripe CLI](#local-testing-with-stripe-cli)
3. Select **API version:** Latest (matches your Stripe library version)
4. Select events to listen to:

#### Required Events ✅

```
✅ checkout.session.completed    → New subscription created, allocate initial tokens
✅ invoice.paid                  → Monthly renewal, refresh tokens
✅ invoice.payment_failed        → Mark subscription as past_due
✅ customer.subscription.updated → Plan changed or status updated
✅ customer.subscription.deleted → Subscription canceled
```

5. Copy the **Signing secret** (starts with `whsec_...`)
6. Add to your `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 3. Configure Billing Portal (Optional)

Go to **Stripe Dashboard > Settings > Billing**:

- Enable "Customer portal"
- Configure allowed actions:
  - ✅ Update payment method
  - ✅ Change plan (upgrade/downgrade)
  - ✅ Cancel subscription
  - ✅ View invoices

---

## Database Schema

The integration uses these Supabase tables:

### `subscription_plans`
Stores available subscription plans (pre-populated by migration).

```sql
id                    | TEXT PRIMARY KEY (free/starter/growth/agency)
name                  | TEXT (display name)
monthly_price_cents   | INTEGER (price in cents)
monthly_tokens        | INTEGER (tokens allocated per month)
```

### `user_subscriptions`
Stores each user's current subscription.

```sql
user_id               | UUID (FK to auth.users)
plan_id               | TEXT (FK to subscription_plans)
stripe_customer_id    | TEXT (Stripe customer ID)
stripe_subscription_id| TEXT (Stripe subscription ID)
status                | TEXT (active/past_due/canceled)
current_period_start  | TIMESTAMPTZ
current_period_end    | TIMESTAMPTZ
```

### `user_token_balances`
Stores current token balance for each user.

```sql
user_id   | UUID (FK to auth.users)
balance   | INTEGER (current tokens available)
```

### `user_token_ledger`
Audit log of all token transactions.

```sql
user_id   | UUID (FK to auth.users)
change    | INTEGER (positive for credit, negative for debit)
reason    | TEXT (subscription_initial, monthly_refresh, video_generation, etc.)
metadata  | JSONB (additional context)
```

### `stripe_webhook_events` ✨ NEW
Prevents duplicate webhook processing (idempotency).

```sql
id           | TEXT PRIMARY KEY (Stripe event ID: evt_...)
type         | TEXT (event type)
processed_at | TIMESTAMPTZ (when processed)
status       | TEXT (processed/failed)
error        | TEXT (error message if failed)
data         | JSONB (event payload for debugging)
```

---

## API Endpoints

### For Frontend Use

| Endpoint                        | Method | Purpose                          |
|---------------------------------|--------|----------------------------------|
| `/api/billing/checkout`         | POST   | Create checkout session          |
| `/api/billing/portal`           | POST   | Create billing portal session    |

#### Example: Create Checkout Session

```typescript
const response = await fetch('/api/billing/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    planId: 'starter' // or 'growth', 'agency'
  })
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Checkout
```

#### Example: Open Billing Portal

```typescript
const response = await fetch('/api/billing/portal', {
  method: 'POST'
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Portal
```

### For Stripe Webhooks

| Endpoint                   | Method | Purpose                |
|----------------------------|--------|------------------------|
| `/api/webhooks/stripe`     | POST   | Handle Stripe webhooks |

**⚠️ Important:** This endpoint is called by Stripe, not your frontend.

---

## Local Testing with Stripe CLI

### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

### Forward Webhooks to Localhost

```bash
# Login to Stripe
stripe login

# Forward webhooks to your local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI will output a webhook signing secret (starts with `whsec_...`). Add this to your `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### Trigger Test Events

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test invoice payment
stripe trigger invoice.paid

# Test payment failure
stripe trigger invoice.payment_failed

# Test subscription cancellation
stripe trigger customer.subscription.deleted
```

Monitor your terminal to see webhook logs.

---

## Testing Checklist

### ✅ Checkout Flow
1. Go to `/dashboard/billing`
2. Click "Upgrade" on any plan
3. Complete checkout with test card: `4242 4242 4242 4242`
4. Verify redirect to `/dashboard/billing?success=true`
5. Check database:
   - `user_subscriptions` updated with Stripe IDs
   - `user_token_balances` increased
   - `user_token_ledger` shows `subscription_initial` entry
   - `stripe_webhook_events` shows `checkout.session.completed`

### ✅ Billing Portal
1. Go to `/dashboard/billing` (as subscribed user)
2. Click "Cambiar Plan / Método de Pago"
3. Verify Stripe portal opens
4. Try changing payment method
5. Try upgrading/downgrading plan
6. Check database updates after changes

### ✅ Webhook Idempotency
1. Use Stripe CLI to trigger the same event twice:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger checkout.session.completed  # Same event again
   ```
2. Check logs: Second event should say "already processed, skipping"
3. Check `stripe_webhook_events` table: Only ONE entry with that event ID
4. Check `user_token_ledger`: Tokens NOT duplicated

### ✅ Payment Failure
1. Trigger payment failure:
   ```bash
   stripe trigger invoice.payment_failed
   ```
2. Check `user_subscriptions.status` → should be `past_due`
3. Verify tokens are NOT deducted (Stripe will retry)

### ✅ Monthly Renewal
1. Simulate successful renewal:
   ```bash
   stripe trigger invoice.paid
   ```
2. Check `user_subscriptions` dates updated
3. Check `user_token_balances` refreshed with monthly tokens
4. Check `user_token_ledger` shows `monthly_refresh` entry

---

## Monitoring & Logs

### View Webhook Logs

**Stripe Dashboard:**
- Go to **Developers > Webhooks**
- Click on your endpoint
- View "Attempted events" tab
- See successes/failures and response codes

**Application Logs:**
All webhook events are logged with prefix `[WEBHOOK]`:

```
[WEBHOOK] Processing event evt_... of type checkout.session.completed
[WEBHOOK] Subscription updated to active for user: uuid-...
[WEBHOOK] Tokens refreshed: 300 for user: uuid-...
[WEBHOOK] Event evt_... marked as processed
```

### Common Issues

| Issue                          | Cause                            | Solution                                    |
|--------------------------------|----------------------------------|---------------------------------------------|
| "Webhook Error: ..."           | Invalid signature                | Check `STRIPE_WEBHOOK_SECRET`               |
| "No Stripe customer found"     | User not in database             | Ensure trigger on new user works            |
| Tokens not allocated           | Webhook not received             | Check endpoint configuration in Stripe      |
| Duplicate tokens               | Webhook fired twice              | Check `stripe_webhook_events` table         |
| "Internal Error" (500)         | Processing failed                | Check app logs and `stripe_webhook_events.error` |

---

## Migration Guide

To apply the database migrations:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase Dashboard > SQL Editor
```

Required migrations (in order):
1. `20251206_subscriptions.sql` (base tables)
2. `20250118_stripe_webhook_idempotency.sql` (idempotency table) ✨ NEW

---

## Architecture Notes

### Why Two Billing Systems Exist

The codebase previously had two parallel Stripe integrations:

- **Old:** `/api/stripe/*` + `profiles` table (deprecated, still present)
- **New:** `/api/billing/*` + `/api/webhooks/stripe` + `user_subscriptions` table ✅

**Current status:**
- ✅ `/api/billing/*` endpoints are the **active** system
- ⚠️ `/api/stripe/*` endpoints exist but are **not used**
- ⚠️ `profiles.stripe_*` columns exist but are **deprecated**
- 🔄 `/app/billing` redirects to `/dashboard/billing`

### Idempotency Strategy

Webhooks use **post-processing idempotency**:

1. Verify Stripe signature
2. Check if event ID exists in `stripe_webhook_events`
3. If exists → return 200 immediately (already processed)
4. If not → process event logic
5. Insert event ID to `stripe_webhook_events` (only on success)

This prevents duplicate token allocation if Stripe retries a webhook.

---

## Production Checklist

Before going live:

- [ ] Replace test API keys with live keys
- [ ] Update webhook endpoint to production URL
- [ ] Test with real (small amount) payment
- [ ] Set up Stripe alerts (failed payments, etc.)
- [ ] Monitor logs for first 24 hours
- [ ] Document customer support process for billing issues
- [ ] Set up invoice email notifications in Stripe
- [ ] Configure tax settings if applicable

---

## Support

For Stripe-related issues:
- **Stripe Dashboard Logs:** Track webhook delivery and API errors
- **Application Logs:** Check `[WEBHOOK]` prefixed logs
- **Database:** Query `stripe_webhook_events` for processing history

For code issues:
- Check `src/app/api/webhooks/stripe/route.ts` (webhook handler)
- Check `src/app/api/billing/checkout/route.ts` (checkout)
- Check `src/app/api/billing/portal/route.ts` (portal)
- Check `src/lib/stripe.ts` (client configuration)

---

**Last Updated:** January 2025
