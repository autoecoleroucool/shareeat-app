/*
  # Create challenge group messages

  ## Summary
  Adds a group messaging system for culinary challenge members.
  Only accepted members of a challenge can send and read messages in that challenge's chat.

  ## New Tables
  - `challenge_messages`
    - `id` (uuid, PK)
    - `challenge_id` (uuid, FK to culinary_challenges)
    - `sender_id` (uuid, FK to profiles)
    - `content` (text)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only accepted members can SELECT messages from a challenge
  - Only accepted members can INSERT messages into a challenge
  - No UPDATE or DELETE allowed (immutable chat history)
*/

CREATE TABLE IF NOT EXISTS challenge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES culinary_challenges(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_messages_challenge_id ON challenge_messages(challenge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_messages_sender_id ON challenge_messages(sender_id);

ALTER TABLE challenge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accepted members can read challenge messages"
  ON challenge_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = challenge_messages.challenge_id
        AND culinary_challenge_members.user_id = auth.uid()
        AND culinary_challenge_members.status = 'accepted'
    )
  );

CREATE POLICY "Accepted members can send challenge messages"
  ON challenge_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM culinary_challenge_members
      WHERE culinary_challenge_members.challenge_id = challenge_messages.challenge_id
        AND culinary_challenge_members.user_id = auth.uid()
        AND culinary_challenge_members.status = 'accepted'
    )
  );
