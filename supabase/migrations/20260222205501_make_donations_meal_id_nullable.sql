/*
  # Make donations.meal_id nullable

  ## Change
  - `meal_id` in donations table becomes optional (nullable)
  - This allows standalone solidarity donations not linked to any meal
*/

ALTER TABLE donations ALTER COLUMN meal_id DROP NOT NULL;
