/*
  # Add listing category to meals table

  ## Summary
  Extends the meals table to support the two main ShareEat categories:
  - food_rescue: surplus groceries, expiring items, quick pickup
  - homemade_meal: cooked meals with social sharing

  ## Changes

  ### Modified Tables
  - `meals`
    - Added `category` column (text, default 'homemade_meal') - distinguishes food rescue vs homemade meals
    - Added `expires_at` column (timestamptz, nullable) - for food rescue items expiring soon
    - Added `quantity` column (text, nullable) - description of quantity for food rescue items

  ## Notes
  1. All existing meals default to 'homemade_meal' category to preserve backward compatibility
  2. The expires_at field is only relevant for food_rescue category items
  3. No destructive operations — only additive column changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'category'
  ) THEN
    ALTER TABLE meals ADD COLUMN category text NOT NULL DEFAULT 'homemade_meal';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE meals ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE meals ADD COLUMN quantity text;
  END IF;
END $$;
