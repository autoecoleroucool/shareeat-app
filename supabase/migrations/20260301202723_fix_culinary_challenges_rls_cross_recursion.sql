/*
  # Fix cross-table RLS recursion between culinary_challenges and culinary_challenge_members

  ## Problem
  Two policies create a mutual recursion loop:
  - culinary_challenges SELECT → queries culinary_challenge_members (to check if user is accepted member)
  - culinary_challenge_members SELECT → queries culinary_challenges (to check challenge status)

  This causes "infinite recursion detected in policy" errors when creating challenges.

  ## Fix
  Replace the culinary_challenges SELECT policy to use a SECURITY DEFINER function
  that bypasses RLS when checking culinary_challenge_members, breaking the cycle.

  The culinary_challenge_members policy already uses is_accepted_challenge_member()
  which is SECURITY DEFINER - but that function itself queries culinary_challenge_members
  directly (bypassing RLS), so it won't re-trigger the policy.

  For culinary_challenges, we create a new SECURITY DEFINER function that checks
  culinary_challenge_members without going through RLS.
*/

CREATE OR REPLACE FUNCTION user_is_accepted_in_challenge(challenge_uuid uuid)
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

DROP POLICY IF EXISTS "Members and creators can view challenges" ON culinary_challenges;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges
  FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    OR creator_id = auth.uid()
    OR user_is_accepted_in_challenge(id)
  );
