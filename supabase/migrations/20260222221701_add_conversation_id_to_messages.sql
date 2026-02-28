/*
  # Add conversation_id to messages table

  Links each message to its conversation for proper thread-based querying.
  Also fixes RLS so both sender and receiver (and conversation participants) can read messages.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'conversation_id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE messages ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON messages;

CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR (
      conversation_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
        AND (c.host_id = auth.uid() OR c.guest_id = auth.uid())
      )
    )
  );

CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
