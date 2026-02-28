/*
  # Meal expiration cleanup

  ## Summary
  Adds automatic filtering of expired food_rescue items and a cleanup function.

  ## Changes
  1. RPC `cleanup_expired_meals()` - marks expired food_rescue meals as claimed so they 
     disappear from listings. Can be called periodically.
  2. Added a generated computed column approach is not used here - instead we rely on 
     the `expires_at` filter being applied in queries.

  ## Notes
  - Expired meals are hidden by filtering `expires_at > now()` in queries
  - This cleanup function marks expired items as claimed to prevent them from
    appearing in non-filtered contexts
*/

CREATE OR REPLACE FUNCTION cleanup_expired_meals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE meals
  SET claimed = true
  WHERE
    category = 'food_rescue'
    AND claimed = false
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
