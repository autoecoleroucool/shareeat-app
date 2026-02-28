/*
  # Add read_at column to messages table

  ## Summary
  Adds a `read_at` timestamp column to the messages table to track when each message was read by the recipient.

  ## Changes
  - `messages` table: new `read_at` column (nullable timestamptz, null = unread)

  ## Notes
  - Existing messages are treated as read (no migration of data needed, unread count will start fresh)
  - RLS policies remain unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN read_at timestamptz DEFAULT NULL;
  END IF;
END $$;
