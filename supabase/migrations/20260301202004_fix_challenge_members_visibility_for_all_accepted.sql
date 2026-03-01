/*
  # Fix challenge members visibility for all accepted members

  ## Problem
  The SELECT policy on culinary_challenge_members only lets users see member rows if:
  - It's their own row
  - The challenge is 'open' or 'active'

  Accepted members cannot see the full member list of a challenge that is
  'in_progress' or 'completed', which breaks the ChallengeDetailScreen.

  ## Fix
  Extend the policy so accepted members can see all member rows for challenges
  they belong to, regardless of challenge status.

  ## Security
  - Authenticated users only
  - Users can always see their own membership row
  - Accepted members can see all member rows for their accepted challenge
  - Open/active challenges remain visible to all authenticated users (for discovery)
*/

DROP POLICY IF EXISTS "Members can view challenge memberships" ON culinary_challenge_members;

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
          OR EXISTS (
            SELECT 1 FROM culinary_challenge_members AS my_membership
            WHERE my_membership.challenge_id = culinary_challenge_members.challenge_id
              AND my_membership.user_id = auth.uid()
              AND my_membership.status = 'accepted'
          )
        )
    )
  );
