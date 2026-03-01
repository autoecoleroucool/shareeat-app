/*
  # Fix cross-table infinite recursion between culinary_challenges and culinary_challenge_members

  ## Problem
  - culinary_challenges SELECT policy referenced culinary_challenge_members
  - culinary_challenge_members SELECT policy referenced culinary_challenges
  - This created a cross-table infinite recursion loop

  ## Fix
  - Simplify culinary_challenges SELECT: only check status = 'open' OR creator_id = auth.uid()
    (remove the subquery referencing culinary_challenge_members)
  - This breaks the recursion cycle while keeping access secure
*/

DROP POLICY IF EXISTS "Circle members can view open or own challenges" ON culinary_challenges;

CREATE POLICY "Anyone can view open or own challenges"
  ON culinary_challenges FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    OR creator_id = auth.uid()
  );
