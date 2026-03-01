/*
  # Fix RLS auth() performance and function search paths

  ## Summary
  1. Replace auth.uid() with (select auth.uid()) in all affected RLS policies
     to avoid re-evaluation per row (significant performance improvement at scale)
  2. Fix mutable search_path on security-sensitive functions

  ## Tables affected
  - culinary_challenges (4 policies)
  - culinary_challenge_members (4 policies)
  - culinary_challenge_meals (4 policies)
  - culinary_challenge_ratings (4 policies)
  - culinary_circle_hidden_members (3 policies)
  - culinary_hidden_photos (3 policies)
  - challenge_messages (2 policies)
*/

-- ============================================================
-- culinary_challenges
-- ============================================================
DROP POLICY IF EXISTS "Members and creators can view challenges" ON culinary_challenges;
DROP POLICY IF EXISTS "Circle members can create challenges" ON culinary_challenges;
DROP POLICY IF EXISTS "Creator can update challenge" ON culinary_challenges;
DROP POLICY IF EXISTS "Creator can delete challenge" ON culinary_challenges;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR creator_id = (select auth.uid())
    OR user_is_accepted_in_challenge(id)
  );

CREATE POLICY "Circle members can create challenges"
  ON culinary_challenges FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Creator can update challenge"
  ON culinary_challenges FOR UPDATE TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

CREATE POLICY "Creator can delete challenge"
  ON culinary_challenges FOR DELETE TO authenticated
  USING (creator_id = (select auth.uid()));

-- ============================================================
-- culinary_challenge_members
-- ============================================================
DROP POLICY IF EXISTS "Members can view challenge memberships" ON culinary_challenge_members;
DROP POLICY IF EXISTS "Members can join challenges" ON culinary_challenge_members;
DROP POLICY IF EXISTS "Members can respond to own invitation" ON culinary_challenge_members;
DROP POLICY IF EXISTS "Members can leave challenges" ON culinary_challenge_members;
DROP POLICY IF EXISTS "Creator can accept or reject members" ON culinary_challenge_members;

CREATE POLICY "Members can view challenge memberships"
  ON culinary_challenge_members FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND (
          culinary_challenges.status IN ('open', 'active')
          OR culinary_challenges.creator_id = (select auth.uid())
          OR is_accepted_challenge_member(culinary_challenge_members.challenge_id)
        )
    )
  );

CREATE POLICY "Members can join challenges"
  ON culinary_challenge_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Members can respond to own invitation"
  ON culinary_challenge_members FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Members can leave challenges"
  ON culinary_challenge_members FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Creator can accept or reject members"
  ON culinary_challenge_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND culinary_challenges.creator_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND culinary_challenges.creator_id = (select auth.uid())
    )
  );

-- ============================================================
-- culinary_challenge_meals
-- ============================================================
DROP POLICY IF EXISTS "Challenge members can view meals" ON culinary_challenge_meals;
DROP POLICY IF EXISTS "Members can add their meal" ON culinary_challenge_meals;
DROP POLICY IF EXISTS "Host can update their meal" ON culinary_challenge_meals;
DROP POLICY IF EXISTS "Host can delete their meal" ON culinary_challenge_meals;

CREATE POLICY "Challenge members can view meals"
  ON culinary_challenge_meals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = culinary_challenge_meals.challenge_id
        AND culinary_challenge_members.user_id = (select auth.uid())
        AND culinary_challenge_members.status = 'accepted'
    )
  );

CREATE POLICY "Members can add their meal"
  ON culinary_challenge_meals FOR INSERT TO authenticated
  WITH CHECK (
    host_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = culinary_challenge_meals.challenge_id
        AND culinary_challenge_members.user_id = (select auth.uid())
        AND culinary_challenge_members.status = 'accepted'
    )
  );

CREATE POLICY "Host can update their meal"
  ON culinary_challenge_meals FOR UPDATE TO authenticated
  USING (host_id = (select auth.uid()))
  WITH CHECK (host_id = (select auth.uid()));

CREATE POLICY "Host can delete their meal"
  ON culinary_challenge_meals FOR DELETE TO authenticated
  USING (host_id = (select auth.uid()));

-- ============================================================
-- culinary_challenge_ratings
-- ============================================================
DROP POLICY IF EXISTS "Challenge members can view ratings" ON culinary_challenge_ratings;
DROP POLICY IF EXISTS "Members can rate meals" ON culinary_challenge_ratings;
DROP POLICY IF EXISTS "Rater can update own rating" ON culinary_challenge_ratings;
DROP POLICY IF EXISTS "Rater can delete own rating" ON culinary_challenge_ratings;

CREATE POLICY "Challenge members can view ratings"
  ON culinary_challenge_ratings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenge_meals ccm
      JOIN culinary_challenge_members mem ON mem.challenge_id = ccm.challenge_id
      WHERE ccm.id = culinary_challenge_ratings.challenge_meal_id
        AND mem.user_id = (select auth.uid())
        AND mem.status = 'accepted'
    )
  );

CREATE POLICY "Members can rate meals"
  ON culinary_challenge_ratings FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM culinary_challenge_meals ccm
      JOIN culinary_challenge_members mem ON mem.challenge_id = ccm.challenge_id
      WHERE ccm.id = culinary_challenge_ratings.challenge_meal_id
        AND mem.user_id = (select auth.uid())
        AND mem.status = 'accepted'
        AND ccm.host_id <> (select auth.uid())
    )
  );

CREATE POLICY "Rater can update own rating"
  ON culinary_challenge_ratings FOR UPDATE TO authenticated
  USING (rater_id = (select auth.uid()))
  WITH CHECK (rater_id = (select auth.uid()));

CREATE POLICY "Rater can delete own rating"
  ON culinary_challenge_ratings FOR DELETE TO authenticated
  USING (rater_id = (select auth.uid()));

-- ============================================================
-- culinary_circle_hidden_members
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own hidden list" ON culinary_circle_hidden_members;
DROP POLICY IF EXISTS "Users can add to their hidden list" ON culinary_circle_hidden_members;
DROP POLICY IF EXISTS "Users can remove from their hidden list" ON culinary_circle_hidden_members;

CREATE POLICY "Users can view their own hidden list"
  ON culinary_circle_hidden_members FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can add to their hidden list"
  ON culinary_circle_hidden_members FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can remove from their hidden list"
  ON culinary_circle_hidden_members FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================
-- culinary_hidden_photos
-- ============================================================
DROP POLICY IF EXISTS "Users can view own hidden photos" ON culinary_hidden_photos;
DROP POLICY IF EXISTS "Users can hide photos" ON culinary_hidden_photos;
DROP POLICY IF EXISTS "Users can unhide photos" ON culinary_hidden_photos;

CREATE POLICY "Users can view own hidden photos"
  ON culinary_hidden_photos FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can hide photos"
  ON culinary_hidden_photos FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can unhide photos"
  ON culinary_hidden_photos FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- challenge_messages
-- ============================================================
DROP POLICY IF EXISTS "Accepted members can read challenge messages" ON challenge_messages;
DROP POLICY IF EXISTS "Accepted members can send challenge messages" ON challenge_messages;

CREATE POLICY "Accepted members can read challenge messages"
  ON challenge_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = challenge_messages.challenge_id
        AND culinary_challenge_members.user_id = (select auth.uid())
        AND culinary_challenge_members.status = 'accepted'
    )
  );

CREATE POLICY "Accepted members can send challenge messages"
  ON challenge_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = challenge_messages.challenge_id
        AND culinary_challenge_members.user_id = (select auth.uid())
        AND culinary_challenge_members.status = 'accepted'
    )
  );

-- ============================================================
-- Fix mutable search_path on functions
-- ============================================================
ALTER FUNCTION public.update_culinary_challenge_updated_at() SET search_path = public;
ALTER FUNCTION public.is_accepted_challenge_member(uuid) SET search_path = public;
ALTER FUNCTION public.user_is_accepted_in_challenge(uuid) SET search_path = public;
