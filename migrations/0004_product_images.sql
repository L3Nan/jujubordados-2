CREATE TABLE IF NOT EXISTS store_assets (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type = 'image/webp'),
  image_data BLOB NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length > 0 AND byte_length <= 409600),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
