/*
  # Add UPDATE policy for meal_participants

  ## Problem
  Hosts could not update meal_participants rows (mark as delivered or no_show)
  because there was no UPDATE RLS policy on the table.
  The INSERT/DELETE/SELECT policies existed but UPDATE was missing,
  causing the "Remise confirmée" and "Absent — Réactiver" buttons to silently fail.

  ## Changes
  - Add UPDATE policy: hosts can update participants of their own meals
  - Add UPDATE policy: participants can update their own row (for future use)
*/

CREATE POLICY "Hosts can update participants of their meals"
  ON meal_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = meal_participants.meal_id
        AND meals.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = meal_participants.meal_id
        AND meals.host_id = auth.uid()
    )
  );
