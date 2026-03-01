/*
  # Fix infinite recursion in culinary_challenges RLS policies

  ## Problem
  The "Members and creators can view challenges" policy on culinary_challenges calls
  user_has_pending_challenge_invite(), which queries culinary_challenge_members.
  The culinary_challenge_members SELECT policy in turn queries culinary_challenges.
  This creates infinite mutual recursion.

  ## Fix
  Replace the function-based pending check with a direct subquery that bypasses
  the challenge visibility policy by only checking membership status for the
  current user — which doesn't require reading culinary_challenges again.

  Also allow joining active challenges (not just open) so members can apply
  when a challenge is already running but has space.
*/

DROP POLICY IF EXISTS "Members and creators can view challenges" ON culinary_challenges;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR creator_id = (SELECT auth.uid())
    OR user_is_accepted_in_challenge(id)
    OR EXISTS (
      SELECT 1 FROM culinary_challenge_members ccm
      WHERE ccm.challenge_id = culinary_challenges.id
        AND ccm.user_id = (SELECT auth.uid())
        AND ccm.status = 'pending'
    )
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.shares_count >= 10
      )
    )
  );
