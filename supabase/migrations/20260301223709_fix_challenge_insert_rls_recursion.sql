/*
  # Fix infinite recursion on culinary_challenges INSERT

  ## Problem
  When a user creates a challenge (INSERT), Postgres evaluates the WITH CHECK policy on
  culinary_challenges, which calls user_is_accepted_in_challenge() → queries
  culinary_challenge_members → whose SELECT policy calls is_challenge_creator() →
  which queries culinary_challenges again → infinite recursion.

  ## Fix
  1. Replace is_challenge_creator() so it does NOT query culinary_challenges.
     Instead it queries culinary_challenge_members directly (looking for a row
     where the user is the creator stored there), OR we bypass the function entirely
     in the culinary_challenge_members SELECT policy by using a direct auth.uid() comparison
     against the challenge's creator_id via a SECURITY DEFINER helper that bypasses RLS.

  2. The cleanest fix: rewrite is_challenge_creator() as SECURITY DEFINER so it
     bypasses RLS when reading culinary_challenges, breaking the recursion loop.

  3. Similarly rewrite is_accepted_challenge_member() and the other helpers as
     SECURITY DEFINER to avoid any cross-table RLS recursion.
*/

CREATE OR REPLACE FUNCTION is_challenge_creator(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenges
    WHERE id = challenge_uuid
    AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_accepted_challenge_member(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenge_members
    WHERE challenge_id = challenge_uuid
    AND user_id = auth.uid()
    AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION user_is_accepted_in_challenge(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenge_members
    WHERE challenge_id = challenge_uuid
    AND user_id = auth.uid()
    AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION user_has_pending_in_challenge(challenge_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM culinary_challenge_members
    WHERE challenge_id = challenge_uuid
    AND user_id = auth.uid()
    AND status = 'pending'
  );
$$;
