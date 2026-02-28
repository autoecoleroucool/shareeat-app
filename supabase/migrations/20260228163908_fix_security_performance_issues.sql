/*
  # Fix Security and Performance Issues

  ## Summary
  Addresses all reported security and performance warnings:

  1. Missing indexes on foreign keys (blocked_users, culinary_invitations, deleted_conversations, meal_favorites)
  2. RLS policies using auth.uid() directly replaced with (select auth.uid()) for init plan optimization
     - deleted_conversations (3 policies)
     - messages (1 policy)
     - push_subscriptions (4 policies)
     - culinary_circle_photos (4 policies)
     - culinary_invitations (4 policies)
     - chef_favorites (3 policies)
  3. Unused indexes dropped
  4. Functions fixed with immutable search_path
*/

-- ============================================================
-- 1. ADD MISSING INDEXES ON UNINDEXED FOREIGN KEYS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_culinary_invitations_meal_id ON public.culinary_invitations(meal_id);
CREATE INDEX IF NOT EXISTS idx_deleted_conversations_conversation_id ON public.deleted_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meal_favorites_meal_id ON public.meal_favorites(meal_id);

-- ============================================================
-- 2. FIX RLS POLICIES - deleted_conversations
-- ============================================================

DROP POLICY IF EXISTS "Users can view own deleted conversations" ON public.deleted_conversations;
DROP POLICY IF EXISTS "Users can insert own deleted conversations" ON public.deleted_conversations;
DROP POLICY IF EXISTS "Users can delete own deleted conversations" ON public.deleted_conversations;

CREATE POLICY "Users can view own deleted conversations"
  ON public.deleted_conversations FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own deleted conversations"
  ON public.deleted_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own deleted conversations"
  ON public.deleted_conversations FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 3. FIX RLS POLICIES - messages
-- ============================================================

DROP POLICY IF EXISTS "Receiver can mark messages as read" ON public.messages;

CREATE POLICY "Receiver can mark messages as read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (receiver_id = (SELECT auth.uid()))
  WITH CHECK (receiver_id = (SELECT auth.uid()));

-- ============================================================
-- 4. FIX RLS POLICIES - push_subscriptions
-- ============================================================

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 5. FIX RLS POLICIES - culinary_circle_photos
-- ============================================================

DROP POLICY IF EXISTS "Circle members can view all culinary photos" ON public.culinary_circle_photos;
DROP POLICY IF EXISTS "Authors can insert their own culinary photos" ON public.culinary_circle_photos;
DROP POLICY IF EXISTS "Authors can update their own culinary photos" ON public.culinary_circle_photos;
DROP POLICY IF EXISTS "Authors can delete their own culinary photos" ON public.culinary_circle_photos;

CREATE POLICY "Circle members can view all culinary photos"
  ON public.culinary_circle_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.shares_count >= 10
    )
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY "Authors can insert their own culinary photos"
  ON public.culinary_circle_photos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Authors can update their own culinary photos"
  ON public.culinary_circle_photos FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Authors can delete their own culinary photos"
  ON public.culinary_circle_photos FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 6. FIX RLS POLICIES - culinary_invitations
-- ============================================================

DROP POLICY IF EXISTS "Hosts and guests can view their invitations" ON public.culinary_invitations;
DROP POLICY IF EXISTS "Circle members can send invitations" ON public.culinary_invitations;
DROP POLICY IF EXISTS "Guests can update invitation status" ON public.culinary_invitations;
DROP POLICY IF EXISTS "Hosts can delete their sent invitations" ON public.culinary_invitations;

CREATE POLICY "Hosts and guests can view their invitations"
  ON public.culinary_invitations FOR SELECT
  TO authenticated
  USING (
    host_id = (SELECT auth.uid()) OR guest_id = (SELECT auth.uid())
  );

CREATE POLICY "Circle members can send invitations"
  ON public.culinary_invitations FOR INSERT
  TO authenticated
  WITH CHECK (host_id = (SELECT auth.uid()));

CREATE POLICY "Guests can update invitation status"
  ON public.culinary_invitations FOR UPDATE
  TO authenticated
  USING (guest_id = (SELECT auth.uid()))
  WITH CHECK (guest_id = (SELECT auth.uid()));

CREATE POLICY "Hosts can delete their sent invitations"
  ON public.culinary_invitations FOR DELETE
  TO authenticated
  USING (host_id = (SELECT auth.uid()));

-- ============================================================
-- 7. FIX RLS POLICIES - chef_favorites
-- ============================================================

DROP POLICY IF EXISTS "Users can view own chef favorites" ON public.chef_favorites;
DROP POLICY IF EXISTS "Users can insert own chef favorites" ON public.chef_favorites;
DROP POLICY IF EXISTS "Users can delete own chef favorites" ON public.chef_favorites;

CREATE POLICY "Users can view own chef favorites"
  ON public.chef_favorites FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own chef favorites"
  ON public.chef_favorites FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own chef favorites"
  ON public.chef_favorites FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 8. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_donations_meal_id;
DROP INDEX IF EXISTS public.idx_donations_user_id;
DROP INDEX IF EXISTS public.idx_meal_participants_user_id;
DROP INDEX IF EXISTS public.idx_meal_reports_meal_id;
DROP INDEX IF EXISTS public.idx_meal_reviews_meal_id;
DROP INDEX IF EXISTS public.idx_meal_reviews_participant_id;
DROP INDEX IF EXISTS public.idx_meals_host_id;
DROP INDEX IF EXISTS public.idx_messages_meal_id;
DROP INDEX IF EXISTS public.idx_messages_receiver_id;
DROP INDEX IF EXISTS public.idx_messages_sender_id;
DROP INDEX IF EXISTS public.idx_user_reports_conversation_id;
DROP INDEX IF EXISTS public.idx_user_reports_reported_id;
DROP INDEX IF EXISTS public.idx_user_reports_reporter_id;
DROP INDEX IF EXISTS public.idx_user_xp_log_meal_id;
DROP INDEX IF EXISTS public.idx_user_xp_log_user_id;
DROP INDEX IF EXISTS public.push_subscriptions_user_id_idx;
DROP INDEX IF EXISTS public.idx_meals_location_lat;
DROP INDEX IF EXISTS public.idx_meals_location_lng;
DROP INDEX IF EXISTS public.idx_meals_location_lat_lng;
DROP INDEX IF EXISTS public.idx_meals_claimed;
DROP INDEX IF EXISTS public.culinary_invitations_status_idx;
DROP INDEX IF EXISTS public.idx_chef_favorites_chef_id;

-- ============================================================
-- 9. FIX FUNCTIONS WITH MUTABLE SEARCH PATH
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_culinary_invitation_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
