-- Migration: Add atomic billing RPCs for token management
-- These functions ensure thread-safe token deductions and refunds with proper ledger tracking

-- Function: deduct_tokens
-- Atomically deducts tokens from user balance and creates ledger entry
CREATE OR REPLACE FUNCTION deduct_tokens(
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
  -- Lock the row for update to prevent race conditions
  SELECT balance INTO v_current_balance
  FROM user_token_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_current_balance,
      'required', p_amount
    );
  END IF;

  -- Deduct tokens
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE user_token_balances
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Insert ledger entry (using 'change' column, not 'amount')
  INSERT INTO user_token_ledger (user_id, change, reason, metadata)
  VALUES (p_user_id, -p_amount, p_reason, p_metadata);

  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'deducted', p_amount
  );
END;
$$ LANGUAGE plpgsql;

-- Function: refund_tokens
-- Atomically refunds tokens to user balance and creates ledger entry
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

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_tokens(UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_tokens(UUID, INTEGER, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION refund_tokens(UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_tokens(UUID, INTEGER, TEXT, JSONB) TO service_role;

