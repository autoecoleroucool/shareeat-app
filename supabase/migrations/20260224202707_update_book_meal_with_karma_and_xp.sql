/*
  # Update book_meal function to handle karma, XP, and stats server-side

  ## Summary
  Moves karma decrement, XP increment, and meals_taken counter update
  into the atomic book_meal RPC function so they cannot be manipulated
  client-side.

  ## Changes
  - `book_meal` RPC now atomically:
    1. Books the meal (existing behavior)
    2. Decrements `karma_balance` by 1 for the guest
    3. Increments `xp` and `meals_taken` by 1 for the guest
    4. Inserts a row into `user_xp_log`

  ## Security
  - All profile updates happen inside the database function with SECURITY DEFINER
  - Client can no longer manipulate karma values directly
*/

CREATE OR REPLACE FUNCTION book_meal(p_meal_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slots_total int;
  v_slots_taken int;
  v_host_id uuid;
  v_claimed boolean;
  v_is_food_rescue boolean;
BEGIN
  SELECT slots_total, slots_taken, host_id, claimed,
    (category = 'food_rescue') INTO v_slots_total, v_slots_taken, v_host_id, v_claimed, v_is_food_rescue
  FROM meals
  WHERE id = p_meal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_host_id = p_user_id THEN
    RETURN 'own_meal';
  END IF;

  IF v_claimed = true THEN
    RETURN 'already_claimed';
  END IF;

  IF v_slots_taken >= v_slots_total THEN
    RETURN 'no_slots';
  END IF;

  IF EXISTS (
    SELECT 1 FROM meal_participants
    WHERE meal_id = p_meal_id AND user_id = p_user_id AND no_show = false
  ) THEN
    RETURN 'already_booked';
  END IF;

  INSERT INTO meal_participants (meal_id, user_id, joined_at)
  VALUES (p_meal_id, p_user_id, now());

  UPDATE meals
  SET
    slots_taken = v_slots_taken + 1,
    claimed = CASE WHEN v_is_food_rescue THEN true ELSE (v_slots_taken + 1 >= v_slots_total) END
  WHERE id = p_meal_id;

  UPDATE profiles
  SET
    karma_balance = karma_balance - 1,
    xp = xp + 1,
    meals_taken = meals_taken + 1
  WHERE id = p_user_id;

  INSERT INTO user_xp_log (user_id, delta, reason, meal_id)
  VALUES (p_user_id, 1, 'meal_taken', p_meal_id);

  RETURN 'ok';
END;
$$;
