-- Manual Fix: Correct user account after failed webhook
-- User ID: 9714f54c-a2d2-4d55-8484-23cddf7df90d
-- Issue: checkout.session.completed webhook failed, didn't grant Agency tokens or update plan
--
-- INSTRUCTIONS:
-- 1. First, verify the failed checkout session in Stripe Dashboard
-- 2. Get the subscription_id and plan from the failed checkout
-- 3. Update the values below if needed
-- 4. Run this script

DO $$
DECLARE
    v_user_id UUID := '9714f54c-a2d2-4d55-8484-23cddf7df90d';
    v_target_plan TEXT := 'agency';  -- Change this if different
    v_subscription_id TEXT;  -- We'll get this from Stripe
    v_monthly_tokens INTEGER;
BEGIN
    -- Get the monthly tokens for the target plan
    SELECT monthly_tokens INTO v_monthly_tokens
    FROM public.subscription_plans
    WHERE id = v_target_plan;
    
    IF v_monthly_tokens IS NULL THEN
        RAISE EXCEPTION 'Plan not found: %', v_target_plan;
    END IF;
    
    RAISE NOTICE 'Plan % has % monthly tokens', v_target_plan, v_monthly_tokens;
    
    -- Check current subscription
    RAISE NOTICE 'Current user subscription:';
    PERFORM user_id, plan_id, stripe_subscription_id, status
    FROM user_subscriptions 
    WHERE user_id = v_user_id;
    
    -- NOTE: DO NOT run the update until you verify the subscription ID in Stripe
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'BEFORE RUNNING THIS FIX:';
    RAISE NOTICE '1. Go to Stripe Dashboard';
    RAISE NOTICE '2. Find the customer: cus_TdgCNMJjwjthpA';
    RAISE NOTICE '3. Check active subscriptions';
    RAISE NOTICE '4. If there are 2 active subscriptions, cancel the OLD one (growth)';
    RAISE NOTICE '5. Get the NEW subscription ID (for agency)';
    RAISE NOTICE '6. Update v_subscription_id in this script';
    RAISE NOTICE '7. Uncomment the UPDATE and INSERT statements below';
    RAISE NOTICE '----------------------------------------';
    
    -- UNCOMMENT THESE LINES AFTER VERIFICATION:
    /*
    v_subscription_id := 'sub_XXXXXXXXXXXX';  -- Replace with actual subscription ID from Stripe
    
    -- Update user subscription to agency plan
    UPDATE public.user_subscriptions
    SET 
        plan_id = v_target_plan,
        stripe_subscription_id = v_subscription_id,
        status = 'active',
        updated_at = NOW()
    WHERE user_id = v_user_id;
    
    -- Grant the agency plan tokens (accumulate)
    PERFORM public.grant_plan_tokens(
        v_user_id,
        v_target_plan,
        'manual_fix_failed_webhook',
        jsonb_build_object(
            'subscriptionId', v_subscription_id,
            'originalEvent', 'evt_1Sm9eERrdOsS9PewNrx66Qe8',
            'fixedBy', 'manual_migration',
            'fixedAt', NOW()
        )
    );
    
    RAISE NOTICE 'FIX APPLIED:';
    RAISE NOTICE '- Updated plan to: %', v_target_plan;
    RAISE NOTICE '- Updated subscription_id to: %', v_subscription_id;
    RAISE NOTICE '- Granted % tokens', v_monthly_tokens;
    */
    
END $$;

-- After running the fix, verify the results:
-- SELECT * FROM user_subscriptions WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';
-- SELECT * FROM user_token_balances WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d';
-- SELECT * FROM user_token_ledger WHERE user_id = '9714f54c-a2d2-4d55-8484-23cddf7df90d' ORDER BY created_at DESC LIMIT 5;

