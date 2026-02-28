/*
  # Add location indexes for map bounds performance

  ## Purpose
  Speed up the bounds-based meal queries used by the map screen.
  Previously the map fetched all meals globally; now it fetches only meals
  inside the visible map area using lat/lng range filters.

  ## Changes
  - Add index on `meals.location_lat` for fast range filtering
  - Add index on `meals.location_lng` for fast range filtering
  - Add composite index on `(location_lat, location_lng)` for combined bounds queries
  - Add index on `meals.claimed` to speed up the claimed filter

  ## Notes
  These are non-destructive, additive changes. No data is modified.
*/

CREATE INDEX IF NOT EXISTS idx_meals_location_lat
  ON meals (location_lat);

CREATE INDEX IF NOT EXISTS idx_meals_location_lng
  ON meals (location_lng);

CREATE INDEX IF NOT EXISTS idx_meals_location_lat_lng
  ON meals (location_lat, location_lng);

CREATE INDEX IF NOT EXISTS idx_meals_claimed
  ON meals (claimed);
