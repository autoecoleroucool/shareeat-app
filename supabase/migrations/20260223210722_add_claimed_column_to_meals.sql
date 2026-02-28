/*
  # Add claimed column to meals table

  ## Summary
  Adds a `claimed` boolean column to the meals table to track when a food rescue
  item has been successfully picked up by someone.

  ## Changes

  ### Modified Tables
  - `meals`
    - Added `claimed` (boolean, default false) — set to true when a food rescue item
      is claimed/picked up. This allows filtering out completed food rescue listings
      from the map and explore screens without deleting the record.

  ## Notes
  1. Only food_rescue category items use this field meaningfully
  2. Homemade meals use slots_taken vs slots_total to track availability
  3. Non-destructive — existing rows default to false (unclaimed)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'claimed'
  ) THEN
    ALTER TABLE meals ADD COLUMN claimed boolean NOT NULL DEFAULT false;
  END IF;
END $$;
