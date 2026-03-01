/*
  # Fix infinite RLS recursion on culinary_challenges INSERT

  ## Root Cause
  The recursion chain is:
  1. INSERT on culinary_challenges triggers SELECT policy evaluation
  2. SELECT policy on culinary_challenges calls user_is_accepted_in_challenge(id)
     which queries culinary_challenge_members
  3. SELECT policy on culinary_challenge_members calls is_accepted_challenge_member(challenge_id)
     and is_challenge_creator(challenge_id) which query culinary_challenges
  4. Infinite loop

  ## Fix
  Rewrite the culinary_challenge_members SELECT policy to NOT call any function
  that touches culinary_challenges. Instead, inline the creator check by joining
  directly to culinary_challenges using a SECURITY DEFINER function that bypasses RLS,
  OR simplest: allow members to see rows where they are the user_id OR where
  the challenge creator_id matches auth.uid() - using a direct subquery with
  SECURITY DEFINER to avoid re-triggering culinary_challenges RLS.

  The key insight: culinary_challenge_members SELECT policy must NEVER query
  culinary_challenges (directly or via function), and culinary_challenges SELECT
  policy must NEVER query culinary_challenge_members (directly or via function).
  We must break this circular dependency entirely.
*/

-- Drop the problematic SELECT policy on culinary_challenge_members
DROP POLICY IF EXISTS "Members can view challenge memberships" ON culinary_challenge_members;

-- Create a SECURITY DEFINER function that checks creator_id directly from
-- culinary_challenges bypassing RLS - already exists but let's ensure it's correct
CREATE OR REPLACE FUNCTION get_challenge_creator_id(challenge_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT creator_id FROM culinary_challenges WHERE id = challenge_uuid LIMIT 1;
$$;

-- Rewrite culinary_challenge_members SELECT policy:
-- A user can see a membership row if:
-- 1. They ARE the member (user_id = auth.uid())
-- 2. They are the creator of that challenge (checked via SECURITY DEFINER function - no RLS loop)
-- 3. They have an accepted membership in the same challenge (checked directly, no function call to challenges)
CREATE POLICY "Members can view challenge memberships"
  ON culinary_challenge_members
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR (get_challenge_creator_id(challenge_id) = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM culinary_challenge_members cm2
      WHERE cm2.challenge_id = culinary_challenge_members.challenge_id
        AND cm2.user_id = (SELECT auth.uid())
        AND cm2.status = 'accepted'
    )
  );

-- Now rewrite culinary_challenges SELECT policy to NOT call any function
-- that queries culinary_challenge_members.
-- Instead inline the subqueries directly with SECURITY DEFINER bypass.
DROP POLICY IF EXISTS "Members and creators can view challenges" ON culinary_challenges;

-- Create a SECURITY DEFINER function to check membership without triggering
-- culinary_challenges RLS (reads culinary_challenge_members directly)
CREATE OR REPLACE FUNCTION get_user_challenge_status(challenge_uuid uuid, user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM culinary_challenge_members
  WHERE challenge_id = challenge_uuid AND user_id = user_uuid
  LIMIT 1;
$$;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges
  FOR SELECT
  TO authenticated
  USING (
    (status = 'open')
    OR (creator_id = (SELECT auth.uid()))
    OR (get_user_challenge_status(id, (SELECT auth.uid())) IN ('accepted', 'pending'))
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.shares_count >= 10
      )
    )
  );

-- Also update the DELETE policy on culinary_challenge_members to not use is_challenge_creator
-- which could also trigger recursion
DROP POLICY IF EXISTS "Creator can remove members" ON culinary_challenge_members;

CREATE POLICY "Creator can remove members"
  ON culinary_challenge_members
  FOR DELETE
  TO authenticated
  USING (
    get_challenge_creator_id(challenge_id) = (SELECT auth.uid())
  );

-- Update the UPDATE policy for creator to not use is_challenge_creator
DROP POLICY IF EXISTS "Creator can accept or reject members" ON culinary_challenge_members;

CREATE POLICY "Creator can accept or reject members"
  ON culinary_challenge_members
  FOR UPDATE
  TO authenticated
  USING (get_challenge_creator_id(challenge_id) = (SELECT auth.uid()))
  WITH CHECK (get_challenge_creator_id(challenge_id) = (SELECT auth.uid()));
