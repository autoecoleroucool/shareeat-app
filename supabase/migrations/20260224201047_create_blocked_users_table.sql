/*
  # Create blocked_users table

  ## Summary
  Allows hosts to block other users (guests) so that blocked users can no longer
  see the host's meal listings on Explore and Map screens.

  ## New Tables
  - `blocked_users`
    - `id` (uuid, primary key)
    - `blocker_id` (uuid, FK to profiles) — the user who blocks
    - `blocked_id` (uuid, FK to profiles) — the user being blocked
    - `created_at` (timestamptz)
    - Unique constraint on (blocker_id, blocked_id)

  ## Security
  - RLS enabled
  - Only authenticated users can insert blocks where they are the blocker
  - Only authenticated users can delete their own blocks
  - Users can only read their own block records
*/

CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their own blocks"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Authenticated users can create blocks"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Authenticated users can delete their own blocks"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS blocked_users_blocker_id_idx ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_id_idx ON blocked_users(blocked_id);
