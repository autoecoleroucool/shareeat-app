/*
  # Create culinary_circle_hidden_members table

  ## Purpose
  Allows a Culinary Circle member to personally hide other members from their
  own circle view. This does not globally remove or ban anyone — it only affects
  the visibility for the user who performs the action.

  ## New Table
  - `culinary_circle_hidden_members`
    - `id` (uuid, primary key)
    - `user_id` (uuid) — the person doing the hiding
    - `hidden_user_id` (uuid) — the person being hidden
    - `created_at` (timestamptz)
    - UNIQUE constraint on (user_id, hidden_user_id)

  ## Security
  - RLS enabled
  - Users can only read, insert, and delete their own rows
*/

CREATE TABLE IF NOT EXISTS culinary_circle_hidden_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hidden_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, hidden_user_id)
);

ALTER TABLE culinary_circle_hidden_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hidden list"
  ON culinary_circle_hidden_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add to their hidden list"
  ON culinary_circle_hidden_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove from their hidden list"
  ON culinary_circle_hidden_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_culinary_circle_hidden_user_id ON culinary_circle_hidden_members(user_id);
