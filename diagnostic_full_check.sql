-- ============================================================================
-- DIAGNOSTIC: Full System Check for Stripe Integration
-- User: 9714f54c-a2d2-4d55-8484-23cddf7df90d
-- Customer: cus_TdgCNMJjwjthpA
-- ============================================================================

-- Run this script in Supabase SQL Editor to get a full diagnostic report

\echo '============================================================================'
\echo 'STRIPE INTEGRATION DIAGNOSTIC REPORT'
\echo '============================================================================'

\echo ''
\echo '1. USER SUBSCRIPTION STATUS'
\echo '-------------------------------------------'
SELECT 
    plan_id as "Current Plan",
    status as "Status",
    stripe_subscription_id as "Stripe Sub ID",
    stripe_customer_id as "Stripe Customer ID",
    pending_plan_id as "Pending Plan",
    current_period_end as "Period Ends"
FROM user_subscriptions 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';

\echo ''
\echo '2. TOKEN BALANCE'
\echo '-------------------------------------------'
SELECT 
    balance as "Current Balance",
    updated_at as "Last Updated"
FROM user_token_balances 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';

\echo ''
\echo '3. RECENT TOKEN TRANSACTIONS (Last 10)'
\echo '-------------------------------------------'
SELECT 
    created_at as "Date",
    change as "Change",
    reason as "Reason",
    metadata->>'planId' as "Plan",
    metadata->>'subscriptionId' as "Subscription ID"
FROM user_token_ledger 
WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d'
ORDER BY created_at DESC 
LIMIT 10;

\echo ''
\echo '4. WEBHOOK EVENTS (Last 10)'
\echo '-------------------------------------------'
SELECT 
    processed_at as "Date",
    type as "Event Type",
    status as "Status",
    error as "Error"
FROM stripe_webhook_events
ORDER BY processed_at DESC 
LIMIT 10;

\echo ''
\echo '5. FAILED WEBHOOKS (Last 30 days)'
\echo '-------------------------------------------'
SELECT 
    processed_at as "Date",
    type as "Event Type",
    id as "Event ID",
    error as "Error Message"
FROM stripe_webhook_events
WHERE status = 'failed'
  AND processed_at > NOW() - INTERVAL '30 days'
ORDER BY processed_at DESC;

\echo ''
\echo '6. SUBSCRIPTION PLANS (Available)'
\echo '-------------------------------------------'
SELECT 
    id as "Plan ID",
    name as "Plan Name",
    monthly_tokens as "Monthly Tokens",
    monthly_price_cents / 100.0 as "Price (EUR)"
FROM subscription_plans
ORDER BY monthly_price_cents;

\echo ''
\echo '7. DATABASE SCHEMA CHECK'
\echo '-------------------------------------------'
-- Check if pending columns exist
SELECT 
    column_name as "Column Name",
    data_type as "Data Type"
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
  AND column_name IN ('pending_plan_id', 'pending_effective_date', 'pending_subscription_id')
ORDER BY column_name;

\echo ''
\echo '8. RPCS CHECK'
\echo '-------------------------------------------'
-- Check if RPCs exist
SELECT 
    routine_name as "RPC Name",
    routine_type as "Type"
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('grant_plan_tokens', 'set_user_tokens', 'adjust_tokens')
ORDER BY routine_name;

\echo ''
\echo '============================================================================'
\echo 'DIAGNOSTIC COMPLETE'
\echo '============================================================================'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. If "Pending Plan" columns are missing → Run 20260105_fix_stripe_integration.sql'
\echo '2. If plan_id != "agency" → Run 20260105_manual_fix_user_account.sql'
\echo '3. If balance < 2500 → Run manual fix to grant tokens'
\echo '4. Check Stripe Dashboard for active subscriptions'
\echo '============================================================================'

