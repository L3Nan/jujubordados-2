import { env } from "cloudflare:workers";
import { EMPTY_OPERATIONS, parseOperations, type LocalOrder, type Operations } from "@/data/store-operations";
import { isAdminSession } from "@/lib/admin-auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validOperations(value: unknown): value is Operations {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Operations>;
  if (!Array.isArray(data.orders) || data.orders.length > 500 || !Array.isArray(data.customers) || data.customers.length > 500 || !Array.isArray(data.financeEntries) || data.financeEntries.length > 1000 || !Array.isArray(data.quotes) || data.quotes.length > 500 || !Array.isArray(data.coupons) || data.coupons.length > 200 || !Array.isArray(data.shippingRules) || data.shippingRules.length > 200 || typeof data.monthlyGoalCents !== "number" || !Number.isSafeInteger(data.monthlyGoalCents) || data.monthlyGoalCents < 0) return false;
  return data.orders.every((order) => !!order && typeof order.id === "string" && order.id.length <= 64 && typeof order.customerName === "string" && order.customerName.length <= 120 && typeof order.customerPhone === "string" && typeof order.description === "string" && order.description.length <= 5000 && Number.isSafeInteger(order.totalCents) && order.totalCents >= 0 && ["Novo", "Em produção", "Pronto", "Concluído", "Cancelado"].includes(order.status) && ["Pendente", "Parcial", "Pago"].includes(order.paymentStatus) && Array.isArray(order.payments ?? []) && (order.payments ?? []).length <= 100 && (order.payments ?? []).every((payment) => typeof payment.id === "string" && payment.id.length <= 100 && Number.isSafeInteger(payment.amountCents) && payment.amountCents > 0 && typeof payment.receivedAt === "string" && payment.receivedAt.length <= 40))
    && data.customers.every((customer) => !!customer && typeof customer.id === "string" && typeof customer.name === "string" && typeof customer.phone === "string" && typeof customer.email === "string" && typeof customer.notes === "string" && customer.name.length <= 120 && customer.phone.length <= 40 && customer.email.length <= 160 && customer.notes.length <= 2000)
    && data.financeEntries.every((entry) => !!entry && ["income", "expense"].includes(entry.kind) && Number.isSafeInteger(entry.amountCents) && entry.amountCents >= 0 && typeof entry.description === "string" && entry.description.length <= 500 && typeof entry.category === "string" && entry.category.length <= 100 && typeof entry.date === "string" && entry.date.length <= 10)
    && data.quotes.every((quote) => !!quote && typeof quote.id === "string" && quote.id.length <= 100 && typeof quote.customerName === "string" && Number.isSafeInteger(quote.quantity) && quote.quantity > 0 && quote.quantity <= 10000 && Number.isSafeInteger(quote.unitPriceCents) && quote.unitPriceCents >= 0 && quote.unitPriceCents <= 100_000_000 && ["Em aberto", "Aprovado", "Recusado", "Convertido em pedido"].includes(quote.status))
    && data.coupons.every((coupon) => !!coupon && typeof coupon.id === "string" && coupon.id.length <= 100 && typeof coupon.code === "string" && coupon.code.length <= 40 && ["percentage", "fixed"].includes(coupon.discountType) && Number.isSafeInteger(coupon.amount) && coupon.amount >= 0 && (coupon.discountType !== "percentage" || coupon.amount <= 100) && typeof coupon.active === "boolean")
    && data.shippingRules.every((rule) => !!rule && typeof rule.id === "string" && rule.id.length <= 100 && typeof rule.label === "string" && rule.label.length <= 100 && ["cep", "city", "state", "region"].includes(rule.matchType) && typeof rule.matchValue === "string" && rule.matchValue.length <= 160 && Number.isSafeInteger(rule.priceCents) && rule.priceCents >= 0 && rule.priceCents <= 100_000_000 && typeof rule.active === "boolean");
}

export async function GET(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const stored = await env.DB.prepare("SELECT setting_value FROM store_settings WHERE setting_key = 'operations'").first<{ setting_value: string }>();
    const storedOperations = stored ? parseOperations(stored.setting_value) : EMPTY_OPERATIONS;
    const result = await env.DB.prepare(`
      SELECT o.id, o.customer_name, o.customer_phone, o.subtotal_cents, o.total_cents, o.status, o.payment_status, o.due_date, o.created_at,
        (SELECT json_group_array(json_object('product_name', i.product_name, 'quantity', i.quantity, 'size', i.size, 'color', i.color)) FROM order_items i WHERE i.order_id=o.id) AS items_json,
        (SELECT json_group_array(json_object('id', p.id, 'amountCents', p.amount_cents, 'receivedAt', p.received_at)) FROM order_payments p WHERE p.order_id=o.id) AS payments_json
      FROM orders o ORDER BY o.created_at DESC LIMIT 500
    `).all<{ id: string; customer_name: string; customer_phone: string; total_cents: number; status: LocalOrder["status"]; payment_status: LocalOrder["paymentStatus"]; due_date: string | null; created_at: string; items_json: string; payments_json: string }>();
    const webOrders: LocalOrder[] = (result.results ?? []).map((row) => {
      const items = JSON.parse(row.items_json || "[]") as Array<{ product_name: string; quantity: number; size: string; color: string }>;
      const payments = JSON.parse(row.payments_json || "[]") as NonNullable<LocalOrder["payments"]>;
      return { id: row.id, customerName: row.customer_name, customerPhone: row.customer_phone, description: items.map((item) => `${item.quantity}× ${item.product_name}${item.size ? ` · ${item.size}` : ""}${item.color ? ` · ${item.color}` : ""}`).join(", "), totalCents: row.total_cents, status: row.status, paymentStatus: row.payment_status, createdAt: row.created_at, dueDate: row.due_date ?? undefined, payments };
    });
    const webPhones = new Set(webOrders.map((order) => order.customerPhone.replace(/\D/g, "")));
    const webCustomers = webOrders.filter((order, index, list) => list.findIndex((other) => other.customerPhone.replace(/\D/g, "") === order.customerPhone.replace(/\D/g, "")) === index).map((order) => {
      const existing = storedOperations.customers.find((customer) => customer.phone.replace(/\D/g, "") === order.customerPhone.replace(/\D/g, ""));
      return existing ? { ...existing, name: order.customerName || existing.name } : { id: `WEB-${order.id}`, name: order.customerName, phone: order.customerPhone, email: "", notes: "" };
    });
    const manualOrders = storedOperations.orders.filter((order) => !uuidPattern.test(order.id));
    const operations = { ...storedOperations, orders: [...webOrders, ...manualOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), customers: [...storedOperations.customers.filter((customer) => !webPhones.has(customer.phone.replace(/\D/g, ""))), ...webCustomers] };
    return Response.json({ operations }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "operations_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 900_000) return Response.json({ error: "operations_too_large" }, { status: 413 });
  let body: { operations?: unknown };
  try { body = await request.json() as { operations?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (!validOperations(body.operations) || new TextEncoder().encode(JSON.stringify(body.operations)).byteLength > 900_000) return Response.json({ error: "invalid_operations" }, { status: 400 });
  const operations = body.operations;
  const localOrders = operations.orders.filter((order) => !uuidPattern.test(order.id));
  const webOrders = operations.orders.filter((order) => uuidPattern.test(order.id));
  try {
    await env.DB.prepare("INSERT INTO store_settings (setting_key, setting_value, updated_at) VALUES ('operations', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at").bind(JSON.stringify({ ...operations, orders: localOrders })).run();
    const existing = await env.DB.prepare("SELECT o.id, o.status, o.payment_status, o.due_date, (SELECT json_group_array(json_object('id', p.id, 'amountCents', p.amount_cents, 'receivedAt', p.received_at)) FROM order_payments p WHERE p.order_id=o.id) AS payments_json FROM orders o").all<{ id: string; status: string; payment_status: string; due_date: string | null; payments_json: string }>();
    const currentOrders = new Map((existing.results ?? []).map((row) => [row.id, row]));
    const statements = webOrders.flatMap((order) => {
      const current = currentOrders.get(order.id);
      if (!current) return [];
      const changes = [];
      if (current.status !== order.status || current.payment_status !== order.paymentStatus || current.due_date !== (order.dueDate ?? null)) changes.push(env.DB.prepare("UPDATE orders SET status=?, payment_status=?, due_date=? WHERE id=?").bind(order.status, order.paymentStatus, order.dueDate ?? null, order.id));
      const currentPayments = JSON.parse(current.payments_json || "[]") as NonNullable<LocalOrder["payments"]>;
      const nextPayments = order.payments ?? [];
      if (JSON.stringify([...currentPayments].sort((a, b) => a.id.localeCompare(b.id))) !== JSON.stringify([...nextPayments].sort((a, b) => a.id.localeCompare(b.id)))) {
        changes.push(env.DB.prepare("DELETE FROM order_payments WHERE order_id=?").bind(order.id));
        changes.push(...nextPayments.map((payment) => env.DB.prepare("INSERT INTO order_payments (id, order_id, amount_cents, received_at) VALUES (?, ?, ?, ?)").bind(payment.id, order.id, payment.amountCents, payment.receivedAt)));
      }
      return changes;
    });
    for (let offset = 0; offset < statements.length; offset += 50) await env.DB.batch(statements.slice(offset, offset + 50));
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "operations_save_failed" }, { status: 503 });
  }
}
