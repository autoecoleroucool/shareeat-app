/*
  # Fix shares_count for existing users who were created before the culinary circle migration

  ## Problem
  Users "Youc" and "lemdy" (and potentially others) were created before the migration
  that sets shares_count = 10 for all new users by default. Their shares_count is 0,
  which prevents them from creating culinary challenges even though they are valid
  circle members.

  ## Fix
  Set shares_count = 10 for all existing users who have shares_count = 0,
  so they have the same access as users created after the culinary circle migration.
  This is consistent with the temporary migration (20260228105615) that gives
  all new users shares_count = 10 by default during the testing phase.
*/

UPDATE profiles
SET shares_count = 10
WHERE shares_count = 0;
