# Stripe Testing Guide - Plan Changes

## Setup Stripe CLI

```bash
# Install Stripe CLI
# Windows: https://github.com/stripe/stripe-cli/releases
# Mac: brew install stripe/stripe-tap/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

---

## Test 1: Upgrade (Starter → Growth)

### Step 1: Create test customer + starter subscription
```bash
# Create customer
stripe customers create --email test@example.com --name "Test User"
# Copy customer ID (cus_xxx)

# Create starter subscription
stripe subscriptions create \
  --customer cus_xxx \
  --items[0][price]=price_starter_xxx \
  --metadata[userId]=test-user-id \
  --metadata[planId]=starter
```

### Step 2: Simulate upgrade via API
```bash
# Call your endpoint
curl -X POST http://localhost:3000/api/billing/change-plan \
  -H "Content-Type: application/json" \
  -d '{"targetPlanId": "growth"}'
```

### Step 3: Trigger invoice.paid
```bash
stripe trigger invoice.paid
```

### Expected Results:
- ✅ Subscription updated to Growth price
- ✅ New invoice created and paid
- ✅ Tokens added (plan_change reason)
- ✅ DB: plan_id = 'growth'

---

## Test 2: Downgrade (Growth → Starter)

### Step 1: User on Growth plan
```bash
# Create growth subscription
stripe subscriptions create \
  --customer cus_xxx \
  --items[0][price]=price_growth_xxx \
  --metadata[userId]=test-user-id \
  --metadata[planId]=growth
```

### Step 2: Request downgrade
```bash
curl -X POST http://localhost:3000/api/billing/change-plan \
  -H "Content-Type: application/json" \
  -d '{"targetPlanId": "starter"}'
```

### Step 3: Check Stripe Dashboard
- ✅ Old subscription: cancel_at_period_end = true
- ✅ New subscription: status = trialing, trial_end = old period_end
- ✅ DB: pending_plan_id = 'starter', pending_subscription_id set

### Step 4: Simulate period end (delete old sub)
```bash
# Get old subscription ID
stripe subscriptions list --customer cus_xxx

# Cancel it (simulates period end)
stripe subscriptions cancel sub_xxx_old
```

### Step 5: Trigger webhook
```bash
stripe trigger customer.subscription.deleted
```

### Expected Results:
- ✅ Webhook detects pending downgrade
- ✅ DB: stripe_subscription_id = pending_subscription_id
- ✅ DB: plan_id = 'starter', pending cleared
- ✅ New invoice for Starter will be created

---

## Test 3: Cancel → Free

### Step 1: User on paid plan
```bash
# Existing subscription
stripe subscriptions list --customer cus_xxx
```

### Step 2: Request cancellation
```bash
curl -X POST http://localhost:3000/api/billing/change-plan \
  -H "Content-Type: application/json" \
  -d '{"targetPlanId": "free"}'
```

### Expected Results:
- ✅ Subscription: cancel_at_period_end = true
- ✅ DB: status = 'canceling', pending_plan_id = 'free'

### Step 3: Simulate period end
```bash
stripe subscriptions cancel sub_xxx
stripe trigger customer.subscription.deleted
```

### Expected Results:
- ✅ DB: plan_id = 'free'
- ✅ DB: stripe_subscription_id = null
- ✅ No other active subscriptions

---

## Test 4: Invoice.paid - Token Logic

### Scenario A: Monthly Renewal
```bash
stripe invoices create \
  --customer cus_xxx \
  --subscription sub_xxx \
  --billing-reason subscription_cycle

stripe invoices pay inv_xxx
```

**Expected:** Tokens added with reason `monthly_refresh`

### Scenario B: Plan Change
```bash
stripe invoices create \
  --customer cus_xxx \
  --subscription sub_xxx \
  --billing-reason subscription_update

stripe invoices pay inv_xxx
```

**Expected:** Tokens added with reason `plan_change`

### Scenario C: Other reasons (skip)
```bash
stripe invoices create \
  --customer cus_xxx \
  --billing-reason manual
```

**Expected:** NO tokens added

---

## Debugging Commands

### Check subscription details
```bash
stripe subscriptions retrieve sub_xxx
```

### Check invoice details
```bash
stripe invoices retrieve inv_xxx
```

### Check customer subscriptions
```bash
stripe subscriptions list --customer cus_xxx --status all
```

### Check webhook events
```bash
stripe events list --limit 10
```

### Retrieve specific event
```bash
stripe events retrieve evt_xxx
```

### Resend webhook
```bash
stripe events resend evt_xxx
```

---

## Watch Logs

### Terminal 1: Stripe CLI
```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

### Terminal 2: Next.js Dev
```bash
npm run dev
```

### Terminal 3: Supabase Logs (if local)
```bash
supabase logs
```

---

## Check Database

```sql
-- Check user subscription
SELECT * FROM user_subscriptions WHERE user_id = 'xxx';

-- Check token balance
SELECT * FROM user_token_balances WHERE user_id = 'xxx';

-- Check token ledger
SELECT * FROM user_token_ledger 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check webhook events
SELECT * FROM stripe_webhook_events 
ORDER BY processed_at DESC 
LIMIT 20;
```

---

## Common Issues

### Issue: Webhook not firing
```bash
# Check webhook endpoint is accessible
curl http://localhost:3000/api/webhooks/stripe

# Verify Stripe CLI is forwarding
stripe listen --print-json
```

### Issue: Subscription not updating
```bash
# Check subscription status
stripe subscriptions retrieve sub_xxx

# Check if there's a schedule blocking
stripe subscription-schedules list --subscription sub_xxx
```

### Issue: Tokens not added
```sql
-- Check if event was processed
SELECT * FROM stripe_webhook_events WHERE id = 'evt_xxx';

-- Check ledger for user
SELECT * FROM user_token_ledger WHERE user_id = 'xxx';
```

### Issue: Plan not syncing
```bash
# Check price mapping in code
# Verify STRIPE_PRICES in .env matches Stripe Dashboard

# Check webhook received customer.subscription.updated
stripe events list --type customer.subscription.updated
```

---

## Production Testing

### Test with real payment methods (Stripe test mode)
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

### Failing payment
```
Card: 4000 0000 0000 0341
```

### 3D Secure
```
Card: 4000 0027 6000 3184
```

---

## Cleanup Test Data

```bash
# Delete test subscriptions
stripe subscriptions list --customer cus_xxx
stripe subscriptions delete sub_xxx

# Delete test customer
stripe customers delete cus_xxx
```

```sql
-- Clean test data from DB
DELETE FROM user_subscriptions WHERE user_id = 'test-user-id';
DELETE FROM user_token_balances WHERE user_id = 'test-user-id';
DELETE FROM user_token_ledger WHERE user_id = 'test-user-id';
```
