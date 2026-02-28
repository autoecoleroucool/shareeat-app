/*
  # Fix Security Issues

  1. Unindexed Foreign Keys
     - Add covering indexes for all foreign keys missing them across:
       donations, meal_participants, meal_reports, meal_reviews, meals, messages,
       user_reports, user_xp_log tables

  2. RLS Auth Initialization Plan
     - Replace auth.<function>() with (select auth.<function>()) in all RLS policies
       across profiles, meals, meal_participants, donations, user_xp_log, conversations,
       messages, meal_favorites, user_reports, meal_reports, meal_reviews, blocked_users

  3. Consolidate duplicate UPDATE policies on meal_participants into one

  4. Fix book_meal function search_path to be immutable

  5. Drop unused indexes to reduce overhead
*/

-- ============================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_donations_meal_id ON public.donations(meal_id);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON public.donations(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_participants_user_id ON public.meal_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_reports_meal_id ON public.meal_reports(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_meal_id ON public.meal_reviews(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_reviews_participant_id ON public.meal_reviews(participant_id);
CREATE INDEX IF NOT EXISTS idx_meals_host_id ON public.meals(host_id);
CREATE INDEX IF NOT EXISTS idx_messages_meal_id ON public.messages(meal_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_conversation_id ON public.user_reports(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_id ON public.user_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON public.user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_log_meal_id ON public.user_xp_log(meal_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_log_user_id ON public.user_xp_log(user_id);

-- ============================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_meal_favorites_meal_id;
DROP INDEX IF EXISTS public.blocked_users_blocked_id_idx;

-- ============================================================
-- 3. FIX RLS POLICIES - profiles
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================================
-- 4. FIX RLS POLICIES - meals
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can create meals" ON public.meals;
CREATE POLICY "Authenticated users can create meals"
  ON public.meals FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Hosts can update own meals" ON public.meals;
CREATE POLICY "Hosts can update own meals"
  ON public.meals FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = host_id)
  WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Hosts can delete own meals" ON public.meals;
CREATE POLICY "Hosts can delete own meals"
  ON public.meals FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = host_id);

-- ============================================================
-- 5. FIX RLS POLICIES - meal_participants
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can join meals" ON public.meal_participants;
CREATE POLICY "Authenticated users can join meals"
  ON public.meal_participants FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can leave meals" ON public.meal_participants;
CREATE POLICY "Users can leave meals"
  ON public.meal_participants FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Hosts can update participants of their meals" ON public.meal_participants;
DROP POLICY IF EXISTS "Host can mark bookings as seen" ON public.meal_participants;
CREATE POLICY "Hosts can update participants of their meals"
  ON public.meal_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meals
      WHERE meals.id = meal_participants.meal_id
      AND meals.host_id = (select auth.uid())
    )
    OR (select auth.uid()) = user_id
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meals
      WHERE meals.id = meal_participants.meal_id
      AND meals.host_id = (select auth.uid())
    )
    OR (select auth.uid()) = user_id
  );

-- ============================================================
-- 6. FIX RLS POLICIES - donations
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own donations" ON public.donations;
CREATE POLICY "Users can insert own donations"
  ON public.donations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own donations" ON public.donations;
CREATE POLICY "Users can read own donations"
  ON public.donations FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- 7. FIX RLS POLICIES - user_xp_log
-- ============================================================

DROP POLICY IF EXISTS "Users can view own xp log" ON public.user_xp_log;
CREATE POLICY "Users can view own xp log"
  ON public.user_xp_log FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own xp log" ON public.user_xp_log;
CREATE POLICY "Users can insert own xp log"
  ON public.user_xp_log FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- 8. FIX RLS POLICIES - conversations
-- ============================================================

DROP POLICY IF EXISTS "Conversation participants can view" ON public.conversations;
CREATE POLICY "Conversation participants can view"
  ON public.conversations FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = host_id OR (select auth.uid()) = guest_id);

DROP POLICY IF EXISTS "Conversation participants can update" ON public.conversations;
CREATE POLICY "Conversation participants can update"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = host_id OR (select auth.uid()) = guest_id)
  WITH CHECK ((select auth.uid()) = host_id OR (select auth.uid()) = guest_id);

DROP POLICY IF EXISTS "Guest can create conversation on booking" ON public.conversations;
CREATE POLICY "Guest can create conversation on booking"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = guest_id);

-- ============================================================
-- 9. FIX RLS POLICIES - messages
-- ============================================================

DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = sender_id
    OR (select auth.uid()) = receiver_id
  );

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = sender_id);

-- ============================================================
-- 10. FIX RLS POLICIES - meal_favorites
-- ============================================================

DROP POLICY IF EXISTS "Users can view own favorites" ON public.meal_favorites;
CREATE POLICY "Users can view own favorites"
  ON public.meal_favorites FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.meal_favorites;
CREATE POLICY "Users can insert own favorites"
  ON public.meal_favorites FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.meal_favorites;
CREATE POLICY "Users can delete own favorites"
  ON public.meal_favorites FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- 11. FIX RLS POLICIES - user_reports
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can insert own reports" ON public.user_reports;
CREATE POLICY "Authenticated users can insert own reports"
  ON public.user_reports FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Users can view own submitted reports" ON public.user_reports;
CREATE POLICY "Users can view own submitted reports"
  ON public.user_reports FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = reporter_id);

-- ============================================================
-- 12. FIX RLS POLICIES - meal_reports
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can insert their own meal reports" ON public.meal_reports;
CREATE POLICY "Authenticated users can insert their own meal reports"
  ON public.meal_reports FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Users can read their own meal reports" ON public.meal_reports;
CREATE POLICY "Users can read their own meal reports"
  ON public.meal_reports FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = reporter_id);

-- ============================================================
-- 13. FIX RLS POLICIES - meal_reviews
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.meal_reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.meal_reviews FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = reviewer_id);

-- ============================================================
-- 14. FIX RLS POLICIES - blocked_users
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view their own blocks" ON public.blocked_users;
CREATE POLICY "Authenticated users can view their own blocks"
  ON public.blocked_users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Authenticated users can create blocks" ON public.blocked_users;
CREATE POLICY "Authenticated users can create blocks"
  ON public.blocked_users FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Authenticated users can delete their own blocks" ON public.blocked_users;
CREATE POLICY "Authenticated users can delete their own blocks"
  ON public.blocked_users FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = blocker_id);

-- ============================================================
-- 15. FIX book_meal FUNCTION SEARCH PATH
-- ============================================================

DO $$
DECLARE
  func_sig text;
BEGIN
  SELECT p.oid::regprocedure::text INTO func_sig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'book_meal'
  LIMIT 1;

  IF func_sig IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', func_sig);
  END IF;
END $$;
