/*
  # Add Chef Favorites Table

  ## Summary
  Replaces the meal_favorites concept with chef_favorites — users can follow chefs
  they like and see their upcoming meals. Since meals are ephemeral and disappear
  after expiry, saving individual meals is not useful. Saving chefs is persistent and meaningful.

  ## New Tables
  - `chef_favorites`
    - `id` (uuid, primary key)
    - `user_id` (uuid) - the user who favorited
    - `chef_id` (uuid) - the chef/host being followed
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read, insert, and delete their own chef favorites
*/

CREATE TABLE IF NOT EXISTS chef_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chef_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chef_favorites_unique UNIQUE (user_id, chef_id),
  CONSTRAINT chef_favorites_no_self CHECK (user_id <> chef_id)
);

ALTER TABLE chef_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chef favorites"
  ON chef_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chef favorites"
  ON chef_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chef favorites"
  ON chef_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chef_favorites_user_id ON chef_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_chef_favorites_chef_id ON chef_favorites(chef_id);
