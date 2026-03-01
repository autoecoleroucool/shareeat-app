/*
  # Add location fields to culinary_challenges

  ## Summary
  Adds latitude, longitude and location_name columns to culinary_challenges so that
  challenge creators can pin their challenge to a meeting place visible on the map.

  ## Changes
  - `culinary_challenges`
    - `location_lat` (double precision, nullable) — latitude of the challenge location
    - `location_lng` (double precision, nullable) — longitude of the challenge location
    - `location_name` (text, nullable) — human-readable address / neighbourhood

  ## Notes
  - Columns are nullable so existing rows are unaffected
  - No RLS changes needed (existing policies already cover the table)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'culinary_challenges' AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE culinary_challenges ADD COLUMN location_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'culinary_challenges' AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE culinary_challenges ADD COLUMN location_lng double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'culinary_challenges' AND column_name = 'location_name'
  ) THEN
    ALTER TABLE culinary_challenges ADD COLUMN location_name text;
  END IF;
END $$;
