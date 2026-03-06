/*
  # Add challenge_id column to meals table

  ## Changes
  - Adds optional `challenge_id` column to `meals` table
  - This links a meal to a culinary challenge it was created for
  - Foreign key references culinary_challenges table with cascade delete

  ## Notes
  1. Column is nullable - most meals are not linked to a challenge
  2. Adds index for performance when filtering meals by challenge
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'challenge_id'
  ) THEN
    ALTER TABLE meals ADD COLUMN challenge_id uuid REFERENCES culinary_challenges(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_meals_challenge_id ON meals(challenge_id);
  END IF;
END $$;
