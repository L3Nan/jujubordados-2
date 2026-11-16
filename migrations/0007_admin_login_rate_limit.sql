CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0)
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_window_idx ON admin_login_attempts(window_started_at);
