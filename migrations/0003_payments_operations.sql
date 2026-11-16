ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'Pendente' CHECK (payment_status IN ('Pendente', 'Parcial', 'Pago'));
ALTER TABLE orders ADD COLUMN due_date TEXT;

CREATE TABLE IF NOT EXISTS order_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS order_payments_order_idx ON order_payments(order_id);
