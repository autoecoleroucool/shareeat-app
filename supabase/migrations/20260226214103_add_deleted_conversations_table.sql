/*
  # Add deleted_conversations table

  ## Summary
  Allows users to "delete" a conversation from their own view without affecting
  the other participant. The conversation is simply hidden for the deleting user.

  ## New Tables
  - `deleted_conversations`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users) - the user who deleted
    - `conversation_id` (uuid, FK to conversations) - which conversation was deleted
    - `deleted_at` (timestamptz) - when it was deleted

  ## Security
  - RLS enabled, users can only manage their own records
*/

CREATE TABLE IF NOT EXISTS deleted_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  deleted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

ALTER TABLE deleted_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deleted conversations"
  ON deleted_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deleted conversations"
  ON deleted_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deleted conversations"
  ON deleted_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
