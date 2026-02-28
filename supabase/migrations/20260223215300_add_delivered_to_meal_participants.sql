/*
  # Add delivered status to meal_participants

  ## Summary
  Adds delivery tracking to the meal participation flow.

  ## Changes
  - `meal_participants`
    - New column `delivered` (boolean, default false): set to true when the host confirms they gave the meal to the participant
    - New column `no_show` (boolean, default false): set to true when the host marks participant as no-show and reactivates the slot

  ## Purpose
  Allows the host to:
  1. Confirm that a meal/food was handed over to the participant
  2. Mark a participant as no-show to reactivate the listing slot
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_participants' AND column_name = 'delivered'
  ) THEN
    ALTER TABLE meal_participants ADD COLUMN delivered boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_participants' AND column_name = 'no_show'
  ) THEN
    ALTER TABLE meal_participants ADD COLUMN no_show boolean DEFAULT false;
  END IF;
END $$;
