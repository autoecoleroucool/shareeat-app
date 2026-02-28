/*
  # Fix XP / Karma / Shares separation

  ## Summary
  XP and Karma must be fully independent systems.

  ## Changes

  ### 1. profiles table
  - Add `shares_count` (int, default 0): counts only completed shares (meals given).
    This is the authoritative counter for Culinary Circle access.
  - XP now ONLY increases when the user completes a share (confirm_pickup).
  - XP NEVER increases on booking/claiming a meal.

  ### 2. book_meal RPC
  - Remove `xp + 1` from the guest update.
  - Remove `user_xp_log` insert with reason 'meal_taken'.
  - Still decrements `karma_balance` by 1 and increments `meals_taken`.

  ### 3. confirm_pickup RPC
  - Increments `shares_count` by 1 for the host in addition to existing `meals_given`.
  - Keeps `xp + 1` for host (share completed = XP earned).
  - Keeps `karma_balance + 1` for host (sharing = positive karma).

  ## Culinary Circle / Trusted Cook
  - Access gated on `shares_count >= 10` (NOT xp >= 10).
  - XP is a separate progression metric.
*/

-- 1. Add shares_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shares_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shares_count integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Backfill shares_count from meals_given for existing users
UPDATE profiles SET shares_count = meals_given WHERE shares_count = 0 AND meals_given > 0;

-- 2. Fix book_meal: remove XP increment, keep karma decrement + meals_taken
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

  -- Only karma and meals_taken; XP is NOT awarded for receiving/claiming
  UPDATE profiles
  SET
    karma_balance = karma_balance - 1,
    meals_taken = meals_taken + 1
  WHERE id = p_user_id;

  RETURN 'ok';
END;
$$;

-- 3. Fix confirm_pickup: increment shares_count + xp + karma for host
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

  -- Sharing is rewarded: +1 XP, +1 karma, +1 meals_given, +1 shares_count
  UPDATE profiles
  SET
    meals_given = meals_given + 1,
    shares_count = shares_count + 1,
    xp = xp + 1,
    karma_balance = karma_balance + 1
  WHERE id = p_host_id;

  INSERT INTO user_xp_log (user_id, delta, reason, meal_id)
  VALUES (p_host_id, 1, 'meal_given', p_meal_id);

  DELETE FROM meals WHERE id = p_meal_id;

  RETURN 'ok';
END;
$$;
