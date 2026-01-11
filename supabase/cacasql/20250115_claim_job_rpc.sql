-- Migration: Add claim_job RPC for atomic job queue processing
-- This function atomically claims the next queued job and marks it as processing
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions in multi-worker scenarios

CREATE OR REPLACE FUNCTION claim_job()
RETURNS render_jobs AS $$
DECLARE
  job render_jobs;
BEGIN
  UPDATE render_jobs
  SET status = 'processing',
      updated_at = NOW()
  WHERE id = (
    SELECT id FROM render_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO job;
  
  RETURN job;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION claim_job() TO authenticated;
GRANT EXECUTE ON FUNCTION claim_job() TO service_role;

