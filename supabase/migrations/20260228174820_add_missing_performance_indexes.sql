/*
  # Add missing performance indexes on meals table

  ## Purpose
  Complement existing lat/lng indexes with indexes on columns used
  for filtering and ordering in both ExploreScreen and MapScreen queries.

  ## Changes
  - `meals.expires_at` — used in `.gt(now())` expiry filter on every meal fetch
  - `meals.category` — used in category filter (food_rescue / homemade_meal)
  - `meals.created_at` — used in `.order('created_at', { ascending: false })`
  - `meals.slots_taken` + `meals.slots_total` — used together to filter full meals

  ## Notes
  All changes are additive (IF NOT EXISTS). No data is modified. No downtime.
*/

CREATE INDEX IF NOT EXISTS idx_meals_expires_at
  ON meals (expires_at);

CREATE INDEX IF NOT EXISTS idx_meals_category
  ON meals (category);

CREATE INDEX IF NOT EXISTS idx_meals_created_at
  ON meals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meals_slots
  ON meals (slots_taken, slots_total);
