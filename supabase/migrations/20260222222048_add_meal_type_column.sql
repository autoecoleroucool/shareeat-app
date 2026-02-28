/*
  # Add meal_type column to meals table

  Adds a meal_type column derived from is_premium_meal for map display.
  Backfills existing rows.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'meal_type' AND table_schema = 'public'
  ) THEN
    ALTER TABLE meals ADD COLUMN meal_type text NOT NULL DEFAULT 'standard';
  END IF;
END $$;

UPDATE meals SET meal_type = CASE WHEN is_premium_meal = true THEN 'plus' ELSE 'standard' END WHERE meal_type = 'standard';
