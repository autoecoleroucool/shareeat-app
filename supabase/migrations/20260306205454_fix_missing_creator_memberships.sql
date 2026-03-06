/*
  # Fix missing creator memberships

  ## Problem
  Some culinary challenges were created without a corresponding entry in
  culinary_challenge_members for the creator. This caused the creator to not
  appear in the members list.

  ## Fix
  Insert accepted creator membership records for all challenges where the
  creator does not have a membership entry.

  ## Changes
  - Inserts missing creator membership rows for existing challenges
  - Creator is inserted with role='creator', status='accepted'
*/

INSERT INTO culinary_challenge_members (challenge_id, user_id, role, status, invited_by)
SELECT
  c.id AS challenge_id,
  c.creator_id AS user_id,
  'creator' AS role,
  'accepted' AS status,
  NULL AS invited_by
FROM culinary_challenges c
WHERE NOT EXISTS (
  SELECT 1
  FROM culinary_challenge_members cm
  WHERE cm.challenge_id = c.id
    AND cm.user_id = c.creator_id
);
