/*
  # Add delete_meal function for hosts

  ## Summary
  Allows a meal host to manually delete their own meal listing (homemade or food rescue),
  with a cascade cleanup of associated meal_participants rows.

  ## New Functions
  - `delete_meal(p_meal_id uuid, p_host_id uuid)` — securely deletes a meal only if the caller is the host

  ## Security
  - SECURITY DEFINER with explicit host ownership check
  - Returns 'ok', 'not_found', or 'not_authorized'
*/

CREATE OR REPLACE FUNCTION delete_meal(
  p_meal_id uuid,
  p_host_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meal_host_id uuid;
BEGIN
  SELECT host_id INTO v_meal_host_id
  FROM meals
  WHERE id = p_meal_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_meal_host_id <> p_host_id THEN
    RETURN 'not_authorized';
  END IF;

  DELETE FROM meal_participants WHERE meal_id = p_meal_id;
  DELETE FROM meals WHERE id = p_meal_id;

  RETURN 'ok';
END;
$$;
