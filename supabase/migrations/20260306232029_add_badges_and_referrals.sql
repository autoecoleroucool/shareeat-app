/*
  # Add Badges and Referrals Tables

  ## New Tables

  ### user_badges
  - Stores milestone badges earned by users
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to profiles)
  - `badge_slug` (text) - identifier like 'first_share', 'shares_10', etc.
  - `awarded_at` (timestamptz) - when the badge was earned
  - Unique constraint on (user_id, badge_slug) to prevent duplicates

  ### referrals
  - Tracks who referred whom to the platform
  - `id` (uuid, primary key)
  - `referrer_id` (uuid, FK to profiles) - the user who shared the invite link
  - `referred_id` (uuid, FK to profiles) - the new user who joined via the link
  - `created_at` (timestamptz)
  - Unique constraint on referred_id so each user can only be referred once
  - A trigger rewards the referrer with +1 shares_count on each successful referral

  ## Security
  - RLS enabled on both tables
  - Users can only read their own badges and referrals
  - Users can only insert badges/referrals for themselves

  ## Notes
  1. Badge slugs used: first_share, shares_10, shares_25, community_helper, food_rescue_hero
  2. The referral trigger increments shares_count on the referrer's profile automatically
*/

CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_slug text NOT NULL,
  awarded_at timestamptz DEFAULT now(),
  CONSTRAINT user_badges_unique UNIQUE (user_id, badge_slug)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

CREATE POLICY "Users can view their own badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges"
  ON user_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT referrals_unique_referred UNIQUE (referred_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

CREATE POLICY "Users can view referrals where they are the referrer"
  ON referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Authenticated users can insert referrals for themselves"
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referred_id);


CREATE OR REPLACE FUNCTION handle_new_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET shares_count = shares_count + 1
  WHERE id = NEW.referrer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_referral_created ON referrals;
CREATE TRIGGER on_referral_created
  AFTER INSERT ON referrals
  FOR EACH ROW EXECUTE FUNCTION handle_new_referral();
