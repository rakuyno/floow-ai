# ============================================
# MULTI-MARKET STRIPE CONFIGURATION
# ============================================
#
# Configure Stripe Price IDs for each market (US, ES, MX)
# Create these prices in your Stripe Dashboard for each currency
#
# US Market (USD)
# ============================================
STRIPE_PRICE_FREE_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_US=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_US=price_xxxxxxxxxxxxxxxxxxxxx

# ES Market (EUR)
# ============================================
STRIPE_PRICE_FREE_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_ES=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_ES=price_xxxxxxxxxxxxxxxxxxxxx

# MX Market (MXN)
# ============================================
STRIPE_PRICE_FREE_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH_MX=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY_MX=price_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# LEGACY PRICES (Backward Compatibility)
# ============================================
# These are fallback EUR prices for existing users
# Keep these until full migration is complete
STRIPE_PRICE_FREE=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_AGENCY=price_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# STRIPE CORE CONFIGURATION
# ============================================
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# SUPABASE CONFIGURATION
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxx

# ============================================
# DEPLOYMENT NOTES
# ============================================
#
# When deploying to Vercel/Railway/Production:
# 1. Copy ALL variables from this file to your deployment platform
# 2. Replace placeholder values (price_xxx...) with actual Stripe Price IDs
# 3. Ensure STRIPE_SECRET_KEY uses production key (sk_live_...)
# 4. Ensure STRIPE_WEBHOOK_SECRET matches your production webhook
# 5. Test each market route: /us, /es, /mx
#
# To create Stripe Prices:
# 1. Go to Stripe Dashboard > Products
# 2. Create a product for each plan (Starter, Growth, Agency)
# 3. Add prices for each currency: USD, EUR, MXN
# 4. Copy the price IDs (starting with "price_") to this file
# 5. Note: FREE plan may not need actual Stripe prices if no payment required
#
# Market Configuration:
# - US: USD, English (en)
# - ES: EUR, Spanish-Spain (es-ES)
# - MX: MXN, Spanish-Mexico (es-MX)
#
# ============================================

