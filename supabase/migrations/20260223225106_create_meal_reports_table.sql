/*
  # Create meal_reports table

  1. New Tables
    - `meal_reports`
      - `id` (uuid, primary key)
      - `reporter_id` (uuid, references auth.users)
      - `meal_id` (uuid, references meals)
      - `reason` (text) — category of the report (off_topic, not_food, misleading, spam, inappropriate, expired, other)
      - `details` (text) — optional free-text description
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can insert their own reports
    - Users can read only their own reports
    - Unique constraint prevents duplicate reports from same user on same meal
*/

CREATE TABLE IF NOT EXISTS meal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(reporter_id, meal_id)
);

ALTER TABLE meal_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert their own meal reports"
  ON meal_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read their own meal reports"
  ON meal_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);
