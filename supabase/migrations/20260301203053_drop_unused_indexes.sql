/*
  # Drop unused indexes

  ## Summary
  Removes indexes that have never been used, reducing write overhead and storage.

  ## Indexes removed
  - idx_blocked_users_blocked_id
  - idx_culinary_invitations_meal_id
  - idx_deleted_conversations_conversation_id
  - idx_meal_favorites_meal_id
  - idx_meals_category
  - idx_meals_created_at
  - idx_meals_slots
  - idx_challenge_messages_sender_id
*/

DROP INDEX IF EXISTS public.idx_blocked_users_blocked_id;
DROP INDEX IF EXISTS public.idx_culinary_invitations_meal_id;
DROP INDEX IF EXISTS public.idx_deleted_conversations_conversation_id;
DROP INDEX IF EXISTS public.idx_meal_favorites_meal_id;
DROP INDEX IF EXISTS public.idx_meals_category;
DROP INDEX IF EXISTS public.idx_meals_created_at;
DROP INDEX IF EXISTS public.idx_meals_slots;
DROP INDEX IF EXISTS public.idx_challenge_messages_sender_id;
