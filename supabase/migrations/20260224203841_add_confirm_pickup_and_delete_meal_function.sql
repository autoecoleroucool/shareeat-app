/*
  # Add confirm_pickup function

  ## Summary
  Atomic RPC that confirms a participant has picked up their meal/food item,
  updates stats, and deletes the meal from the platform.

  ## Changes
  - New RPC `confirm_pickup(p_participant_id uuid, p_meal_id uuid, p_host_id uuid)`
    - Marks participant as `delivered = true`
    - Increments `meals_given` on the host profile
    - Increments `xp` on the host profile (+1)
    - Deletes the meal row (cascade deletes participants via FK)
    - Returns 'ok' or 'not_found'

  ## Security
  - SECURITY DEFINER so host can delete meal and update profile atomically
  - Checks that p_host_id matches the meal's host_id before deleting
*/

CREATE OR REPLACE FUNCTION confirm_pickup(
  p_participant_id uuid,
  p_meal_id uuid,
  p_host_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meal_host_id uuid;
BEGIN
  SELECT host_id INTO v_meal_host_id
  FROM meals
  WHERE id = p_meal_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_meal_host_id <> p_host_id THEN
    RETURN 'not_authorized';
  END IF;

  UPDATE meal_participants
  SET delivered = true
  WHERE id = p_participant_id;

  UPDATE profiles
  SET
    meals_given = meals_given + 1,
    xp = xp + 1
  WHERE id = p_host_id;

  INSERT INTO user_xp_log (user_id, delta, reason, meal_id)
  VALUES (p_host_id, 1, 'meal_given', p_meal_id);

  DELETE FROM meals WHERE id = p_meal_id;

  RETURN 'ok';
END;
$$;
