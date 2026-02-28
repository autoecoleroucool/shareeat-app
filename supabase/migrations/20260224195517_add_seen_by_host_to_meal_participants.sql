/*
  # Add seen_by_host to meal_participants

  ## Purpose
  Track whether the host has seen each new booking notification.
  This allows persisting the unread badge count across sessions/reconnections.

  ## Changes
  - `meal_participants`: new boolean column `seen_by_host` (default false)
    Set to true when the host views their messages or navigates to inbox.

  ## Policy
  - Host can update seen_by_host on their own meals' participants
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_participants' AND column_name = 'seen_by_host'
  ) THEN
    ALTER TABLE meal_participants ADD COLUMN seen_by_host boolean DEFAULT false;
  END IF;
END $$;

DROP POLICY IF EXISTS "Host can mark bookings as seen" ON meal_participants;

CREATE POLICY "Host can mark bookings as seen"
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
