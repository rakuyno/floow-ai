-- Migration: Fix refund_tokens to handle missing user_token_balances row
-- This ensures refunds work even if user doesn't have a balance row yet

CREATE OR REPLACE FUNCTION refund_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the row for update
  SELECT balance INTO v_current_balance
  FROM user_token_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user exists, if not initialize with 0 balance
  IF NOT FOUND THEN
    INSERT INTO user_token_balances (user_id, balance, updated_at)
    VALUES (p_user_id, 0, NOW());
    v_current_balance := 0;
  END IF;

  -- Add tokens
  v_new_balance := v_current_balance + p_amount;
  
  UPDATE user_token_balances
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Insert ledger entry (positive amount for refund, using 'change' column)
  INSERT INTO user_token_ledger (user_id, change, reason, metadata)
  VALUES (p_user_id, p_amount, p_reason, p_metadata);

  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'refunded', p_amount
  );
END;
$$ LANGUAGE plpgsql;
