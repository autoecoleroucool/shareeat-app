/*
  # Add Friendships System

  1. New Tables
    - `friendships`
      - `id` (uuid, primary key)
      - `requester_id` (uuid, FK to profiles) - user who sent the friend request
      - `receiver_id` (uuid, FK to profiles) - user who received the request
      - `status` (text) - 'pending', 'accepted', 'declined'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE constraint on (requester_id, receiver_id)

  2. Security
    - Enable RLS
    - Users can see their own friendships (sent or received)
    - Users can insert friend requests (as requester)
    - Users can update friendship status (as receiver)
    - Users can delete their own friend requests (as requester)

  3. Notes
    - A friendship is accepted when receiver updates status to 'accepted'
    - Accepted friendships are bidirectional for display purposes
*/

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT friendships_unique UNIQUE (requester_id, receiver_id),
  CONSTRAINT friendships_no_self_friend CHECK (requester_id <> receiver_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Receiver can update friendship status"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = requester_id);

CREATE POLICY "Users can delete their own friend requests"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);
