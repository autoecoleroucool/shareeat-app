/*
  # Fix infinite recursion between culinary_challenges and culinary_challenge_members

  ## Problem
  - culinary_challenges SELECT policy checks culinary_challenge_members (via pending EXISTS subquery)
  - culinary_challenge_members SELECT policy checks culinary_challenges (via status check)
  - This creates mutual infinite recursion

  ## Fix
  Replace the culinary_challenge_members SELECT policy with one that does NOT
  query culinary_challenges at all. A user can see memberships if:
  1. It is their own membership row
  2. They are an accepted member of that challenge (via SECURITY DEFINER function, bypasses RLS)
  3. They are the creator of that challenge (via SECURITY DEFINER function)

  Also create a helper SECURITY DEFINER function to check creator status without RLS.
*/

CREATE OR REPLACE FUNCTION is_challenge_creator(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenges
    WHERE id = challenge_uuid
    AND creator_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Members can view challenge memberships" ON culinary_challenge_members;

CREATE POLICY "Members can view challenge memberships"
  ON culinary_challenge_members FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_accepted_challenge_member(challenge_id)
    OR is_challenge_creator(challenge_id)
  );
