-- Additive, isolated Gmail schema. No changes to existing customer records.
CREATE TABLE IF NOT EXISTS gmail_v2_connections (
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_cipher TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  sync_cursor TEXT,
  sync_query TEXT,
  error_code TEXT,
  PRIMARY KEY(owner_id,email)
);
CREATE TABLE IF NOT EXISTS gmail_v2_oauth_states (
  state_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  browser_hash TEXT NOT NULL,
  verifier_cipher TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS gmail_v2_oauth_launches (
  ticket_hash TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL REFERENCES gmail_v2_oauth_states(state_hash) ON DELETE CASCADE,
  payload_cipher TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS gmail_v2_messages (
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  mailbox TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  metadata_cipher TEXT NOT NULL,
  message_at TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ,
  PRIMARY KEY(owner_id,mailbox,message_id)
);
CREATE INDEX IF NOT EXISTS gmail_v2_messages_owner_date ON gmail_v2_messages(owner_id,message_at DESC);
ALTER TABLE gmail_v2_messages ADD COLUMN IF NOT EXISTS review_override TEXT CHECK(review_override IN ('review','hidden'));
ALTER TABLE gmail_v2_messages ADD COLUMN IF NOT EXISTS body_scan_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS gmail_v2_link_audit (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  mailbox TEXT NOT NULL,
  previous_client_id UUID,
  next_client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
