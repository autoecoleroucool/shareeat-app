/*
  # Ensure new users always get shares_count = 10

  The handle_new_user trigger was not correctly setting shares_count = 10
  for new registrations. This migration re-applies the correct trigger function
  so every new user automatically gets culinary circle access during testing.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url, shares_count)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    10
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
