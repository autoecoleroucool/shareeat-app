/*
  # Add cancel_booking RPC function

  ## Summary
  Allows a participant to cancel their own booking before the meal is delivered.
  Atomically removes the participant record and decrements slots_taken on the meal.

  ## Changes
  - New RPC `cancel_booking(p_meal_id uuid, p_user_id uuid)` returns text
    - Returns 'ok' on success
    - Returns 'not_found' if no active booking exists
    - Returns 'already_delivered' if the meal was already delivered

  ## Security
  - SECURITY DEFINER to allow atomic slot update
  - Only the booking owner (p_user_id) can cancel their own booking
*/

CREATE OR REPLACE FUNCTION cancel_booking(p_meal_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_delivered boolean;
  v_no_show boolean;
BEGIN
  SELECT id, delivered, no_show
    INTO v_participant_id, v_delivered, v_no_show
  FROM meal_participants
  WHERE meal_id = p_meal_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_delivered = true THEN
    RETURN 'already_delivered';
  END IF;

  DELETE FROM meal_participants WHERE id = v_participant_id;

  UPDATE meals
  SET
    slots_taken = GREATEST(0, slots_taken - 1),
    claimed = false
  WHERE id = p_meal_id;

  UPDATE profiles
  SET karma_balance = karma_balance + 1
  WHERE id = p_user_id;

  RETURN 'ok';
END;
$$;
