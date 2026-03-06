/*
  # Fix culinary_challenge_members SELECT policy - no recursion

  ## Problem
  The previous SELECT policy caused infinite recursion by querying
  culinary_challenge_members inside its own policy.

  ## Fix
  Use a two-part USING clause:
  1. A user can always see their own row (user_id = auth.uid())
  2. A user can see all rows of a challenge if they are an accepted member
     - Use a security definer function to break the recursion

  Simpler approach: allow SELECT if:
    - user_id = auth.uid() (own row, always visible)
    - OR the challenge has the current user as creator (via culinary_challenges table)
    - OR invited_by = auth.uid()
    - OR the challenge_id matches a challenge where auth.uid() is a member
      (via culinary_challenges.creator_id to avoid recursion)

  Cleanest no-recursion approach: create a security definer function.
*/

DROP POLICY IF EXISTS "members_select" ON culinary_challenge_members;

-- Create a security definer function to get challenge IDs for the current user
-- This breaks the RLS recursion
CREATE OR REPLACE FUNCTION get_my_challenge_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT challenge_id
  FROM culinary_challenge_members
  WHERE user_id = auth.uid();
$$;

-- Allow a user to see all members of any challenge they belong to,
-- or their own row (for users who haven't joined yet but are being checked)
CREATE POLICY "members_select"
  ON culinary_challenge_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = ( SELECT auth.uid() AS uid )
    OR invited_by = ( SELECT auth.uid() AS uid )
    OR challenge_id IN ( SELECT get_my_challenge_ids() )
  );
