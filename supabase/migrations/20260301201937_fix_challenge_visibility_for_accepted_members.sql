/*
  # Fix challenge visibility for accepted members

  ## Problem
  The current SELECT policy on culinary_challenges only allows:
  - Anyone to view "open" challenges
  - Creators to view their own challenges

  Accepted members (non-creators) cannot see challenges once status changes
  from "open" to "in_progress" or "completed".

  ## Fix
  Replace the SELECT policy to also grant access to users who are accepted
  members of a challenge, regardless of its status.

  ## Security
  - Authenticated users only
  - Can see open challenges (to discover and apply)
  - Can see challenges they created
  - Can see challenges they are an accepted member of
*/

DROP POLICY IF EXISTS "Anyone can view open or own challenges" ON culinary_challenges;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges
  FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = culinary_challenges.id
        AND culinary_challenge_members.user_id = auth.uid()
        AND culinary_challenge_members.status = 'accepted'
    )
  );
