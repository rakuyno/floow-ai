-- Migration: Subscriptions and Tokens

-- 1. Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  monthly_tokens INTEGER NOT NULL
);

INSERT INTO public.subscription_plans (id, name, monthly_price_cents, monthly_tokens) VALUES
('free', 'Free', 0, 30),
('starter', 'Starter', 2900, 300),
('growth', 'Growth', 7900, 1000),
('agency', 'Agency / Scale', 19900, 2500)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    monthly_tokens = EXCLUDED.monthly_tokens;

-- 2. User Subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 3. Token Balances
CREATE TABLE IF NOT EXISTS public.user_token_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Token Ledger
CREATE TABLE IF NOT EXISTS public.user_token_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. RLS Policies
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read plans" ON public.subscription_plans FOR SELECT USING (true);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.user_token_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own balance" ON public.user_token_balances FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.user_token_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger" ON public.user_token_ledger FOR SELECT USING (auth.uid() = user_id);

-- 6. Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign Free Plan
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
  VALUES (NEW.id, 'free', 'active', now(), now() + interval '1 month');

  -- Initialize Token Balance
  INSERT INTO public.user_token_balances (user_id, balance)
  VALUES (NEW.id, 30);

  -- Log Initial Tokens
  INSERT INTO public.user_token_ledger (user_id, change, reason, metadata)
  VALUES (NEW.id, 30, 'signup_bonus', '{"plan": "free"}'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- 8. RPC for Atomic Token Adjustment
CREATE OR REPLACE FUNCTION public.adjust_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS INTEGER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the row for update
  SELECT balance INTO v_current_balance
  FROM public.user_token_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- Initialize if not exists (should exist due to trigger, but safety first)
    INSERT INTO public.user_token_balances (user_id, balance) VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  -- Check sufficiency for deductions
  IF p_amount < 0 AND (v_current_balance + p_amount) < 0 THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Update Balance
  UPDATE public.user_token_balances
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Insert Ledger Entry
  INSERT INTO public.user_token_ledger (user_id, change, reason, metadata)
  VALUES (p_user_id, p_amount, p_reason, p_metadata);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

