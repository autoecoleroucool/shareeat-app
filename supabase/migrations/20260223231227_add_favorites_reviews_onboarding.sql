/*
  # Add Favorites, Reviews, and Onboarding Support

  1. New Tables
    - `meal_favorites` - persists user likes/favorites on meals
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `meal_id` (uuid, references meals)
      - `created_at` (timestamp)
      - Unique constraint: one favorite per user per meal

    - `meal_reviews` - ratings left after a delivery is confirmed
      - `id` (uuid, primary key)
      - `reviewer_id` (uuid, references profiles)
      - `reviewed_id` (uuid, references profiles - person being rated)
      - `meal_id` (uuid, references meals)
      - `participant_id` (uuid, references meal_participants)
      - `rating` (integer 1-5)
      - `comment` (text, optional)
      - `created_at` (timestamp)

  2. Profiles update
    - Add `onboarding_done` boolean column to profiles table

  3. Security
    - RLS enabled on both new tables
    - Favorites: users can only manage their own favorites
    - Reviews: authenticated users can insert reviews for their own deliveries, read all reviews
*/

-- meal_favorites table
CREATE TABLE IF NOT EXISTS meal_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, meal_id)
);

ALTER TABLE meal_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON meal_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON meal_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON meal_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- meal_reviews table
CREATE TABLE IF NOT EXISTS meal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES meal_participants(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(reviewer_id, meal_id)
);

ALTER TABLE meal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
  ON meal_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own reviews"
  ON meal_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Add onboarding_done column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_done'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_done boolean DEFAULT false;
  END IF;
END $$;

-- Update profiles table rating based on reviews (helper index)
CREATE INDEX IF NOT EXISTS idx_meal_reviews_reviewed_id ON meal_reviews(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_meal_favorites_user_id ON meal_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_favorites_meal_id ON meal_favorites(meal_id);
