/*
  # Fix Creator can accept or reject members UPDATE policy

  ## Problem
  The UPDATE policy on culinary_challenge_members queries culinary_challenges directly,
  which can trigger the challenges SELECT policy and cause recursion.

  ## Fix
  Replace the direct subquery with the is_challenge_creator() SECURITY DEFINER function
  which bypasses RLS and reads the table directly.
*/

DROP POLICY IF EXISTS "Creator can accept or reject members" ON culinary_challenge_members;

CREATE POLICY "Creator can accept or reject members"
  ON culinary_challenge_members FOR UPDATE
  TO authenticated
  USING (is_challenge_creator(challenge_id))
  WITH CHECK (is_challenge_creator(challenge_id));
