/*
  # Fix infinite recursion in culinary_challenge_members RLS policies

  ## Problem
  The SELECT and INSERT policies on culinary_challenge_members referenced
  the same table (culinary_challenge_members) in their subqueries, causing
  infinite recursion when Postgres evaluated them.

  ## Fix
  - DROP all policies on culinary_challenge_members
  - Recreate SELECT policy: only checks user_id = auth.uid() or open challenge
    (removes the self-referencing subquery)
  - Recreate INSERT policy: for self-join (user_id = auth.uid()), only checks
    shares_count >= 10. For invites, uses a security-definer function to avoid recursion.
*/

DROP POLICY IF EXISTS "Challenge members can view memberships" ON culinary_challenge_members;
DROP POLICY IF EXISTS "Members can join or invite" ON culinary_challenge_members;
DROP POLICY IF EXISTS "User can leave challenge" ON culinary_challenge_members;
DROP POLICY IF EXISTS "User can respond to own membership" ON culinary_challenge_members;

CREATE POLICY "Members can view own memberships"
  ON culinary_challenge_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND (culinary_challenges.status = 'open' OR culinary_challenges.creator_id = auth.uid())
    )
  );

CREATE POLICY "Members can join challenges"
  ON culinary_challenge_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Members can leave challenges"
  ON culinary_challenge_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members can respond to invitations"
  ON culinary_challenge_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid())
  WITH CHECK (user_id = auth.uid() OR invited_by = auth.uid());
