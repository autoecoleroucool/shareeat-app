/*
  # Fix culinary_challenge_members UPDATE policy to allow creator acceptance

  ## Problem
  The current UPDATE policy only allows a user to update their own membership row
  (user_id = auth.uid()) or rows they personally invited (invited_by = auth.uid()).
  
  This blocks the challenge creator from accepting members they didn't directly invite,
  since the creator's ID is not in invited_by for all rows.

  ## Fix
  Add a third condition: the current user is the creator of the challenge linked to this member row.

  ## Security
  - Only the challenge creator can accept/decline other members
  - Members can still update their own row (accept/decline invitations)
  - The invited_by condition is preserved for inviters
*/

DROP POLICY IF EXISTS "members_update" ON culinary_challenge_members;

CREATE POLICY "members_update"
  ON culinary_challenge_members FOR UPDATE
  TO authenticated
  USING (
    (user_id = ( SELECT auth.uid() AS uid))
    OR (invited_by = ( SELECT auth.uid() AS uid))
    OR (challenge_id IN (
      SELECT id FROM culinary_challenges WHERE creator_id = ( SELECT auth.uid() AS uid)
    ))
  )
  WITH CHECK (
    (user_id = ( SELECT auth.uid() AS uid))
    OR (invited_by = ( SELECT auth.uid() AS uid))
    OR (challenge_id IN (
      SELECT id FROM culinary_challenges WHERE creator_id = ( SELECT auth.uid() AS uid)
    ))
  );
