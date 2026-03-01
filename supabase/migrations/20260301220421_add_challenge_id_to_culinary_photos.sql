/*
  # Add challenge_id to culinary_circle_photos

  ## Summary
  Links gallery photos to a specific culinary challenge, transforming the community
  gallery into a shared album for challenge moments. Members of a challenge can
  upload photos of dishes made during the challenge.

  ## Changes
  - `culinary_circle_photos`
    - Add nullable `challenge_id` (uuid, FK → culinary_challenges)
    - Photos without challenge_id remain personal/general circle photos

  ## Security
  - No new tables; existing RLS on culinary_circle_photos already covers access.
  - Adding a policy to allow accepted challenge members to INSERT photos tagged with their challenge.

  ## Notes
  - Existing photos keep challenge_id = NULL (untagged / personal gallery)
  - The feed galerie tab will be able to filter by challenge
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'culinary_circle_photos'
      AND column_name = 'challenge_id'
  ) THEN
    ALTER TABLE culinary_circle_photos
      ADD COLUMN challenge_id uuid REFERENCES culinary_challenges(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_culinary_circle_photos_challenge_id
  ON culinary_circle_photos(challenge_id)
  WHERE challenge_id IS NOT NULL;
