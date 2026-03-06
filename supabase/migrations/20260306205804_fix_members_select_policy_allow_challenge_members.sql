/*
  # Fix culinary_challenge_members SELECT policy

  ## Problem
  The current SELECT policy only lets a user see their own membership row.
  This means members cannot see other members in the same challenge - causing
  the members list to only show the current user.

  ## Fix
  Replace the restrictive SELECT policy with one that allows any member of a
  challenge (accepted, pending, or invited) to see all other members of that
  same challenge.

  ## Changes
  - Drops old `members_select` policy
  - Creates new `members_select` policy: a user can see all members of a
    challenge if they themselves are a member of that challenge
*/

DROP POLICY IF EXISTS "members_select" ON culinary_challenge_members;

CREATE POLICY "members_select"
  ON culinary_challenge_members
  FOR SELECT
  TO authenticated
  USING (
    challenge_id IN (
      SELECT cm2.challenge_id
      FROM culinary_challenge_members cm2
      WHERE cm2.user_id = ( SELECT auth.uid() AS uid )
    )
  );
