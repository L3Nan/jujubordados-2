CREATE TABLE IF NOT EXISTS product_inventory (
  product_id TEXT PRIMARY KEY,
  stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO product_inventory (product_id, stock_quantity, low_stock_threshold)
SELECT json_extract(item.value, '$.id'), CAST(json_extract(item.value, '$.stockQuantity') AS INTEGER),
  COALESCE(CAST(json_extract(item.value, '$.lowStockThreshold') AS INTEGER), 0)
FROM store_settings AS settings, json_each(settings.setting_value) AS item
WHERE settings.setting_key = 'catalog'
  AND json_type(item.value, '$.stockQuantity') = 'integer'
  AND json_extract(item.value, '$.stockQuantity') >= 0;

CREATE TRIGGER IF NOT EXISTS order_items_decrement_inventory
AFTER INSERT ON order_items
BEGIN
  UPDATE product_inventory
  SET stock_quantity = stock_quantity - NEW.quantity,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE product_id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS cancelled_order_restore_inventory
AFTER UPDATE OF status ON orders
WHEN NEW.status = 'Cancelado' AND OLD.status <> 'Cancelado'
BEGIN
  UPDATE product_inventory
  SET stock_quantity = stock_quantity + COALESCE((
    SELECT SUM(quantity) FROM order_items WHERE order_id = NEW.id AND product_id = product_inventory.product_id
  ), 0),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS reopened_order_deduct_inventory
AFTER UPDATE OF status ON orders
WHEN OLD.status = 'Cancelado' AND NEW.status <> 'Cancelado'
BEGIN
  UPDATE product_inventory
  SET stock_quantity = stock_quantity - COALESCE((
    SELECT SUM(quantity) FROM order_items WHERE order_id = NEW.id AND product_id = product_inventory.product_id
  ), 0),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = NEW.id);
END;
