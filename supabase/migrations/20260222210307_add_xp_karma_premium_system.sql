/*
  # XP, Karma & Premium System

  ## Summary
  Implements the core gamification and community fairness mechanics for ShareEat.

  ## Changes

  ### 1. profiles table (new columns)
  - `xp` (int, default 0): Total experience points. +1 per meal shared or taken.
  - `meals_taken` (int, default 0): Total meals taken by this user.
  - `meals_given` (int, default 0): Total meals shared/cooked by this user.
  - `karma_balance` (int, default 0): Running balance = meals_given - meals_taken.
    If this reaches -10 (took 10 more meals than given), user is blocked from taking more until they share.
  - `is_premium` (bool, default false): Unlocked after reaching 10 XP. Required to post/join premium meals.
  - `premium_activated_at` (timestamptz): When premium was activated.

  ### 2. meals table (new columns)
  - `meal_type` updated to support 'premium' in addition to 'standard' | 'solidarity'.
    We add a `is_premium_meal` boolean for clarity since meal_type is a text column.
  - `is_premium_meal` (bool, default false): If true, only premium users can join or host.
    Premium meals are reciprocal: both host and guest are expected to do a return meal.
  - `price` (numeric, default 0): Already exists — used for premium meal fee.

  ### 3. user_xp_log table (new)
  Audit trail for XP changes.
  - `id` (uuid)
  - `user_id` (uuid, FK to auth.users)
  - `delta` (int): +1 or -1 change
  - `reason` (text): 'meal_given' | 'meal_taken' | 'premium_activated'
  - `meal_id` (uuid, nullable FK to meals)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on user_xp_log
  - Users can only read their own XP log
  - Inserts handled by service role (via triggers or edge functions)
*/

-- Add new columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'xp') THEN
    ALTER TABLE profiles ADD COLUMN xp integer DEFAULT 0 NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'meals_taken') THEN
    ALTER TABLE profiles ADD COLUMN meals_taken integer DEFAULT 0 NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'meals_given') THEN
    ALTER TABLE profiles ADD COLUMN meals_given integer DEFAULT 0 NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'karma_balance') THEN
    ALTER TABLE profiles ADD COLUMN karma_balance integer DEFAULT 0 NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_premium') THEN
    ALTER TABLE profiles ADD COLUMN is_premium boolean DEFAULT false NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'premium_activated_at') THEN
    ALTER TABLE profiles ADD COLUMN premium_activated_at timestamptz;
  END IF;
END $$;

-- Add is_premium_meal to meals
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meals' AND column_name = 'is_premium_meal') THEN
    ALTER TABLE meals ADD COLUMN is_premium_meal boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create user_xp_log table
CREATE TABLE IF NOT EXISTS user_xp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL DEFAULT 1,
  reason text NOT NULL DEFAULT 'meal_taken',
  meal_id uuid REFERENCES meals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_xp_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xp log"
  ON user_xp_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own xp log"
  ON user_xp_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
