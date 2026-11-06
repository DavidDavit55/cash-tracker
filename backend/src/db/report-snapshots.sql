-- Append-only source reports. Deliberately separate from the live financial record.
CREATE TABLE IF NOT EXISTS client_report_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('maslaka', 'har_bituach')),
  as_of_date DATE NOT NULL,
  issued_on DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE (user_id, source, content_hash)
);
CREATE INDEX IF NOT EXISTS client_reports_by_date ON client_report_snapshots(user_id, source, as_of_date DESC);
