/*
  # Add bio and location to profiles

  1. Changes
    - `profiles` table: add `bio` (text) and `location_name` (text) columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_name text DEFAULT '';
  END IF;
END $$;
