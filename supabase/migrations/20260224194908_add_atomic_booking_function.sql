/*
  # Add atomic booking function to prevent race conditions

  ## Problem
  Multiple users could book the same meal (especially food_rescue/anti-gaspi meals)
  simultaneously because the check for available slots happened client-side,
  after the database insert. This created a race condition where several users
  could bypass the slot limit.

  ## Solution
  A PostgreSQL function that atomically:
  1. Locks the meal row for update
  2. Checks if slots are still available
  3. Checks if a food_rescue meal is already claimed
  4. Inserts the participant if valid
  5. Updates the meal slots_taken and claimed fields
  All in a single transaction, preventing any race condition.

  ## New Functions
  - `book_meal(p_meal_id uuid, p_user_id uuid)`: Atomic booking function
    Returns: 'ok' on success, 'no_slots' if full, 'already_claimed' if food_rescue taken,
             'already_booked' if user already has a booking, 'not_found' if meal doesn't exist
*/

CREATE OR REPLACE FUNCTION book_meal(p_meal_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slots_taken int;
  v_slots_total int;
  v_category text;
  v_claimed boolean;
  v_host_id uuid;
  v_already_booked int;
BEGIN
  SELECT slots_taken, slots_total, category, claimed, host_id
  INTO v_slots_taken, v_slots_total, v_category, v_claimed, v_host_id
  FROM meals
  WHERE id = p_meal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_host_id = p_user_id THEN
    RETURN 'own_meal';
  END IF;

  SELECT COUNT(*) INTO v_already_booked
  FROM meal_participants
  WHERE meal_id = p_meal_id AND user_id = p_user_id AND no_show = false;

  IF v_already_booked > 0 THEN
    RETURN 'already_booked';
  END IF;

  IF v_slots_taken >= v_slots_total THEN
    RETURN 'no_slots';
  END IF;

  IF v_category = 'food_rescue' AND v_claimed = true THEN
    RETURN 'already_claimed';
  END IF;

  INSERT INTO meal_participants (meal_id, user_id)
  VALUES (p_meal_id, p_user_id);

  UPDATE meals
  SET
    slots_taken = v_slots_taken + 1,
    claimed = CASE WHEN v_category = 'food_rescue' THEN true ELSE claimed END
  WHERE id = p_meal_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION book_meal(uuid, uuid) TO authenticated;
