import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

const MAX_BACKUP_BYTES = 900_000;
const statuses = ["Novo", "Em produção", "Pronto", "Concluído", "Cancelado"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown, max = 5000) {
  return typeof value === "string" && value.length <= max;
}

function isInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function validBackup(value: unknown): value is { format: "jujubordados-backup"; version: 1; data: Record<string, unknown> } {
  if (!isRecord(value) || value.format !== "jujubordados-backup" || value.version !== 1 || !isRecord(value.data)) return false;
  const data = value.data;
  const arrays = ["settings", "orders", "orderItems", "orderPayments", "financeEntries", "productInventory", "metrics"];
  if (!arrays.every((key) => Array.isArray(data[key]))) return false;
  const settings = data.settings as unknown[];
  const orders = data.orders as unknown[];
  const items = data.orderItems as unknown[];
  const payments = data.orderPayments as unknown[];
  const finance = data.financeEntries as unknown[];
  const inventory = data.productInventory as unknown[];
  const metrics = data.metrics as unknown[];
  if (settings.length > 100 || orders.length > 20_000 || items.length > 100_000 || payments.length > 100_000 || finance.length > 100_000 || inventory.length > 150 || metrics.length > 100_000) return false;
  if (!settings.every((row) => isRecord(row) && isString(row.setting_key, 100) && isString(row.setting_value, 900_000) && isString(row.updated_at, 40))) return false;
  if (!orders.every((row) => isRecord(row) && isString(row.id, 64) && isString(row.customer_name, 120) && isString(row.customer_phone, 40) && ["delivery", "pickup"].includes(String(row.delivery_mode)) && isString(row.address, 240) && isString(row.city, 100) && isString(row.state, 2) && isString(row.postal_code, 8) && isInteger(row.subtotal_cents, 0, 1_000_000_000) && isInteger(row.discount_cents, 0, 1_000_000_000) && (row.shipping_cents === null || isInteger(row.shipping_cents, 0, 1_000_000_000)) && isInteger(row.total_cents, 0, 1_000_000_000) && (row.coupon_code === null || isString(row.coupon_code, 40)) && statuses.includes(String(row.status)) && ["Pendente", "Parcial", "Pago"].includes(String(row.payment_status)) && (row.due_date === null || isString(row.due_date, 10)) && isString(row.created_at, 40))) return false;
  if (!items.every((row) => isRecord(row) && isInteger(row.id, 1) && isString(row.order_id, 64) && isString(row.product_id, 100) && isString(row.product_name, 160) && isInteger(row.unit_price_cents, 0, 100_000_000) && isInteger(row.quantity, 1, 10_000) && isString(row.size, 60) && isString(row.color, 80))) return false;
  if (!payments.every((row) => isRecord(row) && isString(row.id, 100) && isString(row.order_id, 64) && isInteger(row.amount_cents, 1, 1_000_000_000) && isString(row.received_at, 40))) return false;
  if (!finance.every((row) => isRecord(row) && isString(row.id, 100) && ["income", "expense"].includes(String(row.kind)) && isString(row.category, 100) && isString(row.description, 500) && isInteger(row.amount_cents, 1, 1_000_000_000) && isString(row.entry_date, 10) && (row.related_order_id === null || isString(row.related_order_id, 64)) && (row.related_payment_id === null || isString(row.related_payment_id, 100)) && isString(row.created_at, 40))) return false;
  if (!inventory.every((row) => isRecord(row) && isString(row.product_id, 100) && isInteger(row.stock_quantity) && isInteger(row.low_stock_threshold) && isString(row.updated_at, 40))) return false;
  return metrics.every((row) => isRecord(row) && isString(row.metric_date, 10) && ["visit", "whatsapp_click"].includes(String(row.metric_key)) && isInteger(row.event_count) && isString(row.updated_at, 40));
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_BACKUP_BYTES) return Response.json({ error: "backup_too_large" }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const bodyBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (bodyBytes > MAX_BACKUP_BYTES) return Response.json({ error: "backup_too_large" }, { status: 413 });
  if (!isRecord(body) || body.confirmReplace !== true || !validBackup(body.backup)) return Response.json({ error: "invalid_backup_or_confirmation" }, { status: 400 });

  const backupJson = JSON.stringify(body.backup);
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM order_payments"),
      env.DB.prepare("DELETE FROM finance_entries"),
      env.DB.prepare("DELETE FROM order_items"),
      env.DB.prepare("DELETE FROM orders"),
      env.DB.prepare("DELETE FROM product_inventory"),
      env.DB.prepare("DELETE FROM store_metrics_daily"),
      env.DB.prepare("DELETE FROM store_settings"),
      env.DB.prepare("INSERT INTO store_settings (setting_key, setting_value, updated_at) SELECT json_extract(value, '$.setting_key'), json_extract(value, '$.setting_value'), json_extract(value, '$.updated_at') FROM json_each(?, '$.data.settings')").bind(backupJson),
      env.DB.prepare(`INSERT INTO orders (id, customer_name, customer_phone, delivery_mode, address, city, state, postal_code, subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code, status, payment_status, due_date, created_at)
        SELECT json_extract(value, '$.id'), json_extract(value, '$.customer_name'), json_extract(value, '$.customer_phone'), json_extract(value, '$.delivery_mode'), json_extract(value, '$.address'), json_extract(value, '$.city'), json_extract(value, '$.state'), json_extract(value, '$.postal_code'), json_extract(value, '$.subtotal_cents'), json_extract(value, '$.discount_cents'), json_extract(value, '$.shipping_cents'), json_extract(value, '$.total_cents'), json_extract(value, '$.coupon_code'), json_extract(value, '$.status'), json_extract(value, '$.payment_status'), json_extract(value, '$.due_date'), json_extract(value, '$.created_at') FROM json_each(?, '$.data.orders')`).bind(backupJson),
      env.DB.prepare(`INSERT INTO order_items (id, order_id, product_id, product_name, unit_price_cents, quantity, size, color)
        SELECT json_extract(value, '$.id'), json_extract(value, '$.order_id'), json_extract(value, '$.product_id'), json_extract(value, '$.product_name'), json_extract(value, '$.unit_price_cents'), json_extract(value, '$.quantity'), json_extract(value, '$.size'), json_extract(value, '$.color') FROM json_each(?, '$.data.orderItems')`).bind(backupJson),
      env.DB.prepare(`INSERT INTO order_payments (id, order_id, amount_cents, received_at)
        SELECT json_extract(value, '$.id'), json_extract(value, '$.order_id'), json_extract(value, '$.amount_cents'), json_extract(value, '$.received_at') FROM json_each(?, '$.data.orderPayments')`).bind(backupJson),
      env.DB.prepare(`INSERT INTO finance_entries (id, kind, category, description, amount_cents, entry_date, related_order_id, related_payment_id, created_at)
        SELECT json_extract(value, '$.id'), json_extract(value, '$.kind'), json_extract(value, '$.category'), json_extract(value, '$.description'), json_extract(value, '$.amount_cents'), json_extract(value, '$.entry_date'), json_extract(value, '$.related_order_id'), json_extract(value, '$.related_payment_id'), json_extract(value, '$.created_at') FROM json_each(?, '$.data.financeEntries')`).bind(backupJson),
      env.DB.prepare(`INSERT INTO product_inventory (product_id, stock_quantity, low_stock_threshold, updated_at)
        SELECT json_extract(value, '$.product_id'), json_extract(value, '$.stock_quantity'), json_extract(value, '$.low_stock_threshold'), json_extract(value, '$.updated_at') FROM json_each(?, '$.data.productInventory')`).bind(backupJson),
      env.DB.prepare(`INSERT INTO store_metrics_daily (metric_date, metric_key, event_count, updated_at)
        SELECT json_extract(value, '$.metric_date'), json_extract(value, '$.metric_key'), json_extract(value, '$.event_count'), json_extract(value, '$.updated_at') FROM json_each(?, '$.data.metrics')`).bind(backupJson),
    ]);
    return Response.json({ restored: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "backup_restore_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
