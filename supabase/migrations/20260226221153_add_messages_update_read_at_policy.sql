/*
  # Add UPDATE policy for messages read_at

  ## Problem
  The messages table has no UPDATE RLS policy, so when the frontend tries to
  mark messages as read (set read_at = now()), the update is silently blocked
  by RLS. This means the unread badge never decreases.

  ## Changes
  1. Add UPDATE policy on messages table allowing the receiver to update read_at
     on their own received messages.

  ## Security
  - Only the receiver (auth.uid() = receiver_id) can perform updates
  - The WITH CHECK ensures they can only update rows they receive
*/

CREATE POLICY "Receiver can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);
