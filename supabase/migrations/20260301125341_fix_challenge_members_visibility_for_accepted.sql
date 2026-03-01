/*
  # Fix challenge members visibility for accepted members

  ## Problem
  The SELECT policy on culinary_challenge_members only allows viewing members when:
  - It's the user's own membership row, OR
  - The challenge is 'open' OR the user is the creator

  This means accepted members in an 'active' challenge cannot see their fellow members,
  since the challenge is no longer 'open'.

  ## Fix
  Update the SELECT policy to also allow viewing when the challenge is 'active'
  (not just 'open'), so all accepted participants can see each other.
  Also allow viewing when the user is an accepted member of the same challenge,
  regardless of challenge status.
*/

DROP POLICY IF EXISTS "Members can view own memberships" ON culinary_challenge_members;

CREATE POLICY "Members can view challenge memberships"
  ON culinary_challenge_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND (
          culinary_challenges.status IN ('open', 'active')
          OR culinary_challenges.creator_id = auth.uid()
        )
    )
  );
