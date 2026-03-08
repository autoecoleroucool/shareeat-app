/*
  # Fix meal_reviews unique constraint to use participant_id

  ## Problem
  The unique constraint was on (reviewer_id, meal_id). Since meal_id is now nullable
  (meal gets deleted after pickup), this constraint no longer prevents duplicate reviews.
  NULL values are not considered equal in unique indexes.

  ## Change
  - Drop the old unique constraint on (reviewer_id, meal_id)
  - Add a new unique constraint on (reviewer_id, participant_id) which reliably
    identifies a single booking and survives meal deletion
*/

ALTER TABLE meal_reviews
  DROP CONSTRAINT meal_reviews_reviewer_id_meal_id_key;

ALTER TABLE meal_reviews
  ADD CONSTRAINT meal_reviews_reviewer_id_participant_id_key
  UNIQUE (reviewer_id, participant_id);
