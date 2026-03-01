/*
  # Fix challenge visibility for active challenges

  ## Problem
  Users with shares_count >= 10 cannot see challenges with status 'active'.
  The old policy only showed challenges to:
  - status = 'open' (visible to all)
  - creator
  - accepted members

  This means:
  - Invited users with 'pending' status couldn't see the challenge to respond
  - Eligible users who were never invited couldn't see/join active challenges

  ## Fix
  Extend the SELECT policy to also show active challenges to:
  1. Users with a pending invitation (so they can respond)
  2. All eligible circle members (shares_count >= 10), same as open challenges
     so the circle remains discoverable to all qualified members
*/

CREATE OR REPLACE FUNCTION user_has_pending_challenge_invite(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenge_members
    WHERE challenge_id = challenge_uuid
      AND user_id = auth.uid()
      AND status = 'pending'
  );
$$;

DROP POLICY IF EXISTS "Members and creators can view challenges" ON culinary_challenges;

CREATE POLICY "Members and creators can view challenges"
  ON culinary_challenges FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR creator_id = (select auth.uid())
    OR user_is_accepted_in_challenge(id)
    OR user_has_pending_challenge_invite(id)
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = (select auth.uid())
          AND profiles.shares_count >= 10
      )
    )
  );
