/*
  # Fix infinite recursion in culinary_challenge_members SELECT policy

  ## Problem
  The previous policy on culinary_challenge_members referenced the same table
  (culinary_challenge_members) inside its own USING clause, causing infinite recursion.

  ## Fix
  Rewrite the policy to avoid self-referencing. Instead of checking membership
  by querying culinary_challenge_members again, we rely only on:
  - The user's own row (user_id = auth.uid())
  - The challenge creator (via culinary_challenges)
  - Open/active challenges (no auth required to browse)

  For accepted members needing to see other members, we use a security definer
  function to safely check membership without recursion.
*/

DROP POLICY IF EXISTS "Members can view challenge memberships" ON culinary_challenge_members;

CREATE OR REPLACE FUNCTION is_accepted_challenge_member(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenge_members
    WHERE challenge_id = challenge_uuid
      AND user_id = auth.uid()
      AND status = 'accepted'
  );
$$;

CREATE POLICY "Members can view challenge memberships"
  ON culinary_challenge_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND (
          culinary_challenges.status IN ('open', 'active')
          OR culinary_challenges.creator_id = auth.uid()
          OR is_accepted_challenge_member(culinary_challenge_members.challenge_id)
        )
    )
  );
