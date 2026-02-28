/*
  # Add Culinary Challenges System

  ## Summary
  Creates the "Défi Cercle Culinaire" feature — challenge groups of 3–5 Culinary Circle
  members, each hosting one meal at home, with meal ratings at the end.

  ## New Tables
  - culinary_challenges: The challenge itself (creator, title, status open/active/completed)
  - culinary_challenge_members: Members (applied or invited), with accepted/pending/declined status
  - culinary_challenge_meals: Each member's planned meal for the group
  - culinary_challenge_ratings: Post-meal ratings (1–5 stars + comment), one per person per meal

  ## Notes
  - RLS policies on challenges use a function to avoid forward-reference issues
  - Only Culinary Circle members (shares_count >= 10) can create or join challenges
  - Any accepted member can invite other circle members
  - Members cannot rate their own meal
*/

-- ─────────────────────────────────────────────
-- 1. culinary_challenges
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS culinary_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed')),
  min_members int NOT NULL DEFAULT 3,
  max_members int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE culinary_challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_culinary_challenge_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_culinary_challenge_updated_at ON culinary_challenges;
CREATE TRIGGER trg_culinary_challenge_updated_at
  BEFORE UPDATE ON culinary_challenges
  FOR EACH ROW EXECUTE FUNCTION update_culinary_challenge_updated_at();


-- ─────────────────────────────────────────────
-- 2. culinary_challenge_members
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS culinary_challenge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES culinary_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE culinary_challenge_members ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 3. culinary_challenge_meals
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS culinary_challenge_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES culinary_challenges(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_name text NOT NULL DEFAULT '',
  meal_description text NOT NULL DEFAULT '',
  proposed_date timestamptz,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE culinary_challenge_meals ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 4. culinary_challenge_ratings
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS culinary_challenge_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_meal_id uuid NOT NULL REFERENCES culinary_challenge_meals(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_meal_id, rater_id)
);

ALTER TABLE culinary_challenge_ratings ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 5. RLS Policies — culinary_challenges
-- ─────────────────────────────────────────────

CREATE POLICY "Circle members can view open or own challenges"
  ON culinary_challenges FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE challenge_id = culinary_challenges.id
        AND user_id = auth.uid()
        AND status = 'accepted'
    )
  );

CREATE POLICY "Circle members can create challenges"
  ON culinary_challenges FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND shares_count >= 10
    )
  );

CREATE POLICY "Creator can update challenge"
  ON culinary_challenges FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creator can delete challenge"
  ON culinary_challenges FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- ─────────────────────────────────────────────
-- 6. RLS Policies — culinary_challenge_members
-- ─────────────────────────────────────────────

CREATE POLICY "Challenge members can view memberships"
  ON culinary_challenge_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM culinary_challenge_members AS cm2
      WHERE cm2.challenge_id = culinary_challenge_members.challenge_id
        AND cm2.user_id = auth.uid()
        AND cm2.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE id = culinary_challenge_members.challenge_id
        AND status = 'open'
    )
  );

CREATE POLICY "Members can join or invite"
  ON culinary_challenge_members FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND invited_by IS NULL
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND shares_count >= 10)
    )
    OR
    (
      invited_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM culinary_challenge_members AS cm
        WHERE cm.challenge_id = culinary_challenge_members.challenge_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'accepted'
      )
    )
  );

CREATE POLICY "User can respond to own membership"
  ON culinary_challenge_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid())
  WITH CHECK (user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "User can leave challenge"
  ON culinary_challenge_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 7. RLS Policies — culinary_challenge_meals
-- ─────────────────────────────────────────────

CREATE POLICY "Challenge members can view meals"
  ON culinary_challenge_meals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE challenge_id = culinary_challenge_meals.challenge_id
        AND user_id = auth.uid()
        AND status = 'accepted'
    )
  );

CREATE POLICY "Members can add their meal"
  ON culinary_challenge_meals FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE challenge_id = culinary_challenge_meals.challenge_id
        AND user_id = auth.uid()
        AND status = 'accepted'
    )
  );

CREATE POLICY "Host can update their meal"
  ON culinary_challenge_meals FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can delete their meal"
  ON culinary_challenge_meals FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- ─────────────────────────────────────────────
-- 8. RLS Policies — culinary_challenge_ratings
-- ─────────────────────────────────────────────

CREATE POLICY "Challenge members can view ratings"
  ON culinary_challenge_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM culinary_challenge_meals ccm
      JOIN culinary_challenge_members mem ON mem.challenge_id = ccm.challenge_id
      WHERE ccm.id = culinary_challenge_ratings.challenge_meal_id
        AND mem.user_id = auth.uid()
        AND mem.status = 'accepted'
    )
  );

CREATE POLICY "Members can rate meals"
  ON culinary_challenge_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM culinary_challenge_meals ccm
      JOIN culinary_challenge_members mem ON mem.challenge_id = ccm.challenge_id
      WHERE ccm.id = culinary_challenge_ratings.challenge_meal_id
        AND mem.user_id = auth.uid()
        AND mem.status = 'accepted'
        AND ccm.host_id <> auth.uid()
    )
  );

CREATE POLICY "Rater can update own rating"
  ON culinary_challenge_ratings FOR UPDATE
  TO authenticated
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Rater can delete own rating"
  ON culinary_challenge_ratings FOR DELETE
  TO authenticated
  USING (rater_id = auth.uid());
