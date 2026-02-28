/*
  # Create conversations table

  Links two users (host + guest) around a meal, tracks last message for the thread list.
  Messages themselves go in the existing `messages` table.
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid REFERENCES meals(id) ON DELETE SET NULL,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  last_message_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(meal_id, guest_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Conversation participants can update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id)
  WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE POLICY "Guest can create conversation on booking"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guest_id);

CREATE INDEX IF NOT EXISTS conversations_host_id_idx ON conversations(host_id);
CREATE INDEX IF NOT EXISTS conversations_guest_id_idx ON conversations(guest_id);
