/*
  # Add creator remove member policy

  Allows the challenge creator to delete (remove) any member from their challenge.
  Previously only the member themselves could delete their own row.
*/

CREATE POLICY "Creator can remove members"
  ON culinary_challenge_members
  FOR DELETE
  TO authenticated
  USING (is_challenge_creator(challenge_id));