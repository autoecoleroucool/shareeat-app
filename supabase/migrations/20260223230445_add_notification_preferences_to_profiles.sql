/*
  # Add notification preferences to profiles

  1. Changes
    - `profiles` table: add `push_notifications` boolean column (default true)
    - `profiles` table: add `sms_alerts` boolean column (default false)
    - `profiles` table: add `profile_visible` boolean column (default true)
    - `profiles` table: add `location_sharing` boolean column (default true)

  2. Notes
    - All columns default to sensible values matching the UI defaults
    - No data loss — existing rows get defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'push_notifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN push_notifications boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sms_alerts'
  ) THEN
    ALTER TABLE profiles ADD COLUMN sms_alerts boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'profile_visible'
  ) THEN
    ALTER TABLE profiles ADD COLUMN profile_visible boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_sharing'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_sharing boolean DEFAULT true;
  END IF;
END $$;
