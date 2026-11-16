CREATE TABLE IF NOT EXISTS store_metrics_daily (
  metric_date TEXT NOT NULL,
  metric_key TEXT NOT NULL CHECK (metric_key IN ('visit', 'whatsapp_click')),
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (metric_date, metric_key)
);

CREATE INDEX IF NOT EXISTS store_metrics_date_idx ON store_metrics_daily(metric_date);
