/*
  # Create user reports table

  1. New Tables
    - `user_reports`
      - `id` (uuid, primary key)
      - `reporter_id` (uuid) - the user who filed the report
      - `reported_id` (uuid) - the user being reported
      - `conversation_id` (uuid, nullable) - the conversation context
      - `reason` (text) - category of the report
      - `details` (text, nullable) - optional extra details from reporter
      - `status` (text) - 'pending' | 'reviewed' | 'resolved'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can insert their own reports
    - Authenticated users can read their own reports
    - No update/delete allowed by users (admin only)
*/

CREATE TABLE IF NOT EXISTS user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert own reports"
  ON user_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own submitted reports"
  ON user_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);
