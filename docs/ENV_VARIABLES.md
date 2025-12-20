# Environment Variables Configuration

Copy this to your `.env.local` file and fill in the values.

## Required Variables

```bash
# ============================================
# STRIPE CONFIGURATION
# ============================================

# Stripe API Keys (get from: https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (get from: https://dashboard.stripe.com/products)
# Create these products in your Stripe dashboard with recurring monthly pricing
STRIPE_PRICE_FREE=              # Optional: if free plan has a Stripe price
STRIPE_PRICE_STARTER=price_...  # Required: ~€29/mo
STRIPE_PRICE_GROWTH=price_...   # Required: ~€79/mo
STRIPE_PRICE_AGENCY=price_...   # Required: ~€199/mo

# ============================================
# SUPABASE CONFIGURATION
# ============================================

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Required for webhooks (bypasses RLS)

# ============================================
# APPLICATION CONFIGURATION
# ============================================

# App URL (used for Stripe checkout success/cancel redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to https://yourdomain.com in production

# ============================================
# OPTIONAL: Other Services
# ============================================

# Add your other API keys here (OpenAI, ElevenLabs, etc.)
# OPENAI_API_KEY=sk-...
# ELEVENLABS_API_KEY=...
```

## How to Get These Values

### Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API Keys**
3. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)

### Stripe Webhook Secret

**For Development (Local Testing):**
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret shown (starts with whsec_...)
```

**For Production:**
1. Go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Enter URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events (see STRIPE_SETUP.md)
5. Copy the **Signing secret**

### Stripe Price IDs

1. Go to **Products** in Stripe Dashboard
2. Create products for each plan:
   - **Starter:** €29/month → 300 tokens
   - **Growth:** €79/month → 1,000 tokens
   - **Agency:** €199/month → 2,500 tokens
3. Click on each product and copy the **Price ID** (starts with `price_`)

### Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings > API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Security Notes

⚠️ **Never commit `.env.local` to git!**

- ✅ `.env.local` is git-ignored
- ✅ `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security - keep it secret
- ✅ Use test mode Stripe keys (`sk_test_...`) during development
- ✅ Use production keys (`sk_live_...`) only in production

## Verification

To verify your environment variables are loaded:

```bash
# In your Next.js app
npm run dev

# Check the console for any missing variable errors
```

You can also add this to a test page:

```typescript
console.log({
  stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
  pricesConfigured: {
    starter: !!process.env.STRIPE_PRICE_STARTER,
    growth: !!process.env.STRIPE_PRICE_GROWTH,
    agency: !!process.env.STRIPE_PRICE_AGENCY,
  }
});
```
