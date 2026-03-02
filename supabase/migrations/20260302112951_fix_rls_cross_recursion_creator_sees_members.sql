
/*
  # Fix RLS Cross-Recursion: Creator Can See Members

  ## Problem
  There is a circular RLS dependency:
  - culinary_challenge_members SELECT policy calls get_challenge_creator_id() which reads culinary_challenges
  - culinary_challenges SELECT policy calls get_user_challenge_status() which reads culinary_challenge_members
  This cross-table recursion causes the creator to see zero members on their own challenge.

  ## Solution
  Replace the helper-function-based policies with SECURITY DEFINER functions that bypass RLS
  when checking ownership, breaking the recursion cycle.

  ## Changes
  - Drop and recreate get_challenge_creator_id as SECURITY DEFINER
  - Drop and recreate get_user_challenge_status as SECURITY DEFINER
  - This allows the RLS policies to call these functions without triggering RLS on the target tables
*/

-- Recreate get_challenge_creator_id as SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION get_challenge_creator_id(challenge_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT creator_id FROM culinary_challenges WHERE id = challenge_uuid LIMIT 1;
$$;

-- Recreate get_user_challenge_status as SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION get_user_challenge_status(challenge_uuid uuid, user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM culinary_challenge_members
  WHERE challenge_id = challenge_uuid AND user_id = user_uuid
  LIMIT 1;
$$;
