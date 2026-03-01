/*
  # Remove direct culinary_challenge_members subquery from culinary_challenges SELECT policy

  ## Problem
  The challenges SELECT policy has an inline subquery on culinary_challenge_members
  for checking pending status. Even though the members SELECT policy no longer reads
  challenges, the pending subquery in challenges policy reads members which could
  trigger members policy again.

  ## Fix
  Create a SECURITY DEFINER function for pending check (bypasses RLS entirely),
  then rewrite the challenges SELECT policy to use only SECURITY DEFINER functions.
*/

CREATE OR REPLACE FUNCTION user_has_pending_in_challenge(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenge_members
    WHERE challenge_id = challenge_uuid
    AND user_id = auth.uid()
    AND status = 'pending'
  );
$$;

DROP POLICY IF EXISTS "Members and creators can view challenges" ON culinary_challenges;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR creator_id = (SELECT auth.uid())
    OR user_is_accepted_in_challenge(id)
    OR user_has_pending_in_challenge(id)
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.shares_count >= 10
      )
    )
  );
