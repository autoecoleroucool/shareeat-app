/*
  # Cercle Culinaire — Photos & Invitations System

  ## Overview
  This migration creates the infrastructure for the Culinary Circle premium feature.
  Members who have unlocked the Culinary Circle (shares_count >= 10) can:
  1. Post dedicated culinary photos to their gallery (professional food shots)
  2. Send and receive private invitations to share a meal
  3. View the host's culinary gallery before accepting an invitation

  ## New Tables

  ### culinary_circle_photos
  Stores professional food photos posted by Culinary Circle members.
  Each photo is tied to an author and optionally linked to a past meal.
  - `id` — unique photo identifier
  - `user_id` — the premium member who posted the photo
  - `image_url` — URL to the photo in Supabase Storage
  - `caption` — optional description of the dish
  - `meal_name` — name of the dish
  - `likes_count` — number of likes (for future feature)
  - `created_at` — when the photo was posted

  ### culinary_invitations
  Manages the private invitation flow between Culinary Circle members.
  - `id` — unique invitation identifier
  - `host_id` — the member sending the invitation
  - `guest_id` — the member being invited
  - `meal_id` — optionally linked to an existing meal posting
  - `message` — personal message from host
  - `status` — pending / accepted / declined / next_time
  - `proposed_date` — when the meal is proposed
  - `meal_name` — name of the proposed meal
  - `next_time_note` — note from guest if they respond "next time"
  - `created_at` / `updated_at`

  ## Security
  - RLS enabled on both tables
  - Photos: only the author can insert/update/delete their own photos; all circle members can view
  - Invitations: host can create, guest can update status; both parties can read their invitations
*/

-- ─── culinary_circle_photos ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS culinary_circle_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text DEFAULT '',
  meal_name text NOT NULL DEFAULT '',
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE culinary_circle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can view all culinary photos"
  ON culinary_circle_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Authors can insert their own culinary photos"
  ON culinary_circle_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Authors can update their own culinary photos"
  ON culinary_circle_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own culinary photos"
  ON culinary_circle_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS culinary_circle_photos_user_id_idx
  ON culinary_circle_photos(user_id);

-- ─── culinary_invitations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS culinary_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id uuid REFERENCES meals(id) ON DELETE SET NULL,
  message text DEFAULT '',
  meal_name text NOT NULL DEFAULT '',
  proposed_date timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'next_time')),
  next_time_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_invite CHECK (host_id != guest_id)
);

ALTER TABLE culinary_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts and guests can view their invitations"
  ON culinary_invitations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = host_id OR auth.uid() = guest_id
  );

CREATE POLICY "Circle members can send invitations"
  ON culinary_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Guests can update invitation status"
  ON culinary_invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = guest_id OR auth.uid() = host_id)
  WITH CHECK (auth.uid() = guest_id OR auth.uid() = host_id);

CREATE POLICY "Hosts can delete their sent invitations"
  ON culinary_invitations FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS culinary_invitations_host_id_idx
  ON culinary_invitations(host_id);

CREATE INDEX IF NOT EXISTS culinary_invitations_guest_id_idx
  ON culinary_invitations(guest_id);

CREATE INDEX IF NOT EXISTS culinary_invitations_status_idx
  ON culinary_invitations(status);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_culinary_invitation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER culinary_invitations_updated_at
  BEFORE UPDATE ON culinary_invitations
  FOR EACH ROW EXECUTE FUNCTION update_culinary_invitation_timestamp();
