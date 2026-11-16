CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  entry_date TEXT NOT NULL,
  related_order_id TEXT,
  related_payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS finance_entries_date_idx ON finance_entries(entry_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_entries_order_idx ON finance_entries(related_order_id);

INSERT OR IGNORE INTO finance_entries (id, kind, category, description, amount_cents, entry_date, related_order_id)
SELECT
  json_extract(entry.value, '$.id'),
  json_extract(entry.value, '$.kind'),
  json_extract(entry.value, '$.category'),
  json_extract(entry.value, '$.description'),
  CAST(json_extract(entry.value, '$.amountCents') AS INTEGER),
  json_extract(entry.value, '$.date'),
  json_extract(entry.value, '$.relatedOrderId')
FROM store_settings AS settings, json_each(settings.setting_value, '$.financeEntries') AS entry
WHERE settings.setting_key = 'operations'
  AND json_type(entry.value, '$.id') = 'text'
  AND json_type(entry.value, '$.kind') = 'text'
  AND json_extract(entry.value, '$.kind') IN ('income', 'expense')
  AND json_type(entry.value, '$.category') = 'text'
  AND json_type(entry.value, '$.description') = 'text'
  AND json_type(entry.value, '$.amountCents') = 'integer'
  AND json_extract(entry.value, '$.amountCents') > 0
  AND json_type(entry.value, '$.date') = 'text';
