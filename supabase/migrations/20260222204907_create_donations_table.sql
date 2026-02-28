/*
  # Create donations table

  ## Purpose
  Tracks solidarity donations made by users during meal booking.
  Donations go to homeless associations (associations contre les SDF).

  ## New Tables
  - `donations`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users) - who donated
    - `meal_id` (uuid, FK to meals) - which meal triggered the donation
    - `amount` (numeric) - donation amount in euros
    - `association` (text) - name of the target association
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can insert their own donations
  - Authenticated users can read their own donations
*/

CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  association text NOT NULL DEFAULT 'Restos du Coeur',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own donations"
  ON donations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own donations"
  ON donations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
