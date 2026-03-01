/*
  # Fix challenge members accept policy

  ## Problem
  The UPDATE policy on culinary_challenge_members only allows users to update their own
  membership or ones they invited. This prevents the challenge creator from accepting
  pending member applications.

  ## Changes
  - Drop the existing UPDATE policy
  - Add two separate UPDATE policies:
    1. Members can respond to their own invitations (original behavior)
    2. Challenge creator can accept/reject any pending member
*/

DROP POLICY IF EXISTS "Members can respond to invitations" ON culinary_challenge_members;

CREATE POLICY "Members can respond to own invitation"
  ON culinary_challenge_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creator can accept or reject members"
  ON culinary_challenge_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND culinary_challenges.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM culinary_challenges
      WHERE culinary_challenges.id = culinary_challenge_members.challenge_id
        AND culinary_challenges.creator_id = auth.uid()
    )
  );
