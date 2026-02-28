/*
  # Update meals slots_total constraint

  ## Changes
  - Drops the existing CHECK constraint that required slots_total >= 3
  - Adds a new CHECK constraint requiring slots_total >= 1
  - This allows meal creators to set as few as 1 participant
*/

ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_slots_total_check;

ALTER TABLE meals ADD CONSTRAINT meals_slots_total_check CHECK (slots_total >= 1);
