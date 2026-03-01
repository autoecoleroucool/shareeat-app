/*
  # Add culinary_hidden_photos table

  ## Summary
  Allows users to hide specific photos from the community gallery (FeedTab).
  Hidden photos are filtered out when loading the feed for that user.

  ## New Tables
  - `culinary_hidden_photos`
    - `id` (uuid, primary key)
    - `user_id` (uuid) - the user who wants to hide the photo
    - `photo_id` (uuid) - the photo being hidden
    - `created_at` (timestamp)
    - UNIQUE constraint on (user_id, photo_id)

  ## Security
  - RLS enabled
  - Users can only insert/select/delete their own hidden photo records
*/

CREATE TABLE IF NOT EXISTS culinary_hidden_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES culinary_circle_photos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, photo_id)
);

ALTER TABLE culinary_hidden_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hidden photos"
  ON culinary_hidden_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can hide photos"
  ON culinary_hidden_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unhide photos"
  ON culinary_hidden_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS culinary_hidden_photos_user_id_idx
  ON culinary_hidden_photos(user_id);
