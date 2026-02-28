/*
  # Temp: New users get Culinary Circle access by default

  Sets shares_count = 10 for all new profiles created via the trigger,
  so every new user is automatically part of the Culinary Circle during testing.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
