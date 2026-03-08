/*
  # Add performance indexes for scale

  ## Purpose
  These indexes ensure the application remains fast under high load with many users,
  messages, and concurrent requests.

  ## New Indexes

  ### messages table
  - `(conversation_id, created_at DESC)` — speeds up paginated message loading per conversation
  - `(receiver_id, read_at)` — speeds up unread message count queries per user

  ### conversations table
  - `(host_id, last_message_at DESC)` — speeds up conversation list for hosts
  - `(guest_id, last_message_at DESC)` — speeds up conversation list for guests

  ### meals table
  - `(created_at DESC)` — speeds up the explore feed ordered by newest first
  - `(meal_type, claimed, expires_at)` — speeds up filtered meal queries

  ## Notes
  - All indexes use IF NOT EXISTS to be safe to run multiple times
  - These are read-optimization indexes and have no impact on data integrity
*/

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_read
  ON messages (receiver_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_host_last
  ON conversations (host_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_guest_last
  ON conversations (guest_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_meals_created_at
  ON meals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meals_type_claimed_expires
  ON meals (meal_type, claimed, expires_at);
