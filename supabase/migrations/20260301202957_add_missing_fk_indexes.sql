/*
  # Add missing indexes for unindexed foreign keys

  ## Summary
  Adds covering indexes for all foreign key columns that lack them.
  This improves JOIN and lookup performance significantly.

  ## Tables affected
  - chef_favorites (chef_id)
  - culinary_challenge_meals (challenge_id, host_id)
  - culinary_challenge_members (invited_by, user_id)
  - culinary_challenge_ratings (rater_id)
  - culinary_challenges (creator_id)
  - culinary_circle_hidden_members (hidden_user_id)
  - culinary_hidden_photos (photo_id)
  - donations (meal_id, user_id)
  - meal_participants (user_id)
  - meal_reports (meal_id)
  - meal_reviews (meal_id, participant_id)
  - meals (host_id)
  - messages (meal_id, receiver_id, sender_id)
  - user_reports (conversation_id, reported_id, reporter_id)
  - user_xp_log (meal_id, user_id)
*/

CREATE INDEX IF NOT EXISTS idx_chef_favorites_chef_id ON public.chef_favorites(chef_id);

CREATE INDEX IF NOT EXISTS idx_culinary_challenge_meals_challenge_id ON public.culinary_challenge_meals(challenge_id);
CREATE INDEX IF NOT EXISTS idx_culinary_challenge_meals_host_id ON public.culinary_challenge_meals(host_id);

CREATE INDEX IF NOT EXISTS idx_culinary_challenge_members_invited_by ON public.culinary_challenge_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_culinary_challenge_members_user_id ON public.culinary_challenge_members(user_id);

CREATE INDEX IF NOT EXISTS idx_culinary_challenge_ratings_rater_id ON public.culinary_challenge_ratings(rater_id);

CREATE INDEX IF NOT EXISTS idx_culinary_challenges_creator_id ON public.culinary_challenges(creator_id);

CREATE INDEX IF NOT EXISTS idx_culinary_circle_hidden_members_hidden_user_id ON public.culinary_circle_hidden_members(hidden_user_id);

CREATE INDEX IF NOT EXISTS idx_culinary_hidden_photos_photo_id ON public.culinary_hidden_photos(photo_id);

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
