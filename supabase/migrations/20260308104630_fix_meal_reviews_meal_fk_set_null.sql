/*
  # Fix meal_reviews meal_id FK to allow reviews after meal deletion

  ## Problem
  The confirm_pickup function deletes the meal after delivery. Since meal_reviews
  has FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE, inserting a 
  review after pickup fails because the meal no longer exists.

  ## Change
  - Drop the existing FK constraint on meal_reviews.meal_id
  - Re-add it with ON DELETE SET NULL so meal_id becomes NULL after deletion
  - Make meal_id nullable to support this

  ## Impact
  - Reviews can now be submitted after a meal is confirmed as picked up
  - Existing reviews are preserved (meal_id becomes NULL on meal deletion)
*/

ALTER TABLE meal_reviews
  DROP CONSTRAINT meal_reviews_meal_id_fkey;

ALTER TABLE meal_reviews
  ALTER COLUMN meal_id DROP NOT NULL;

ALTER TABLE meal_reviews
  ADD CONSTRAINT meal_reviews_meal_id_fkey
  FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL;
