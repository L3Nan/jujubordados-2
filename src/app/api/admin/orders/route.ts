import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";
import { products as initialCatalog, type StoreProduct } from "@/data/catalog";

const statuses = ["Novo", "Em produção", "Pronto", "Concluído", "Cancelado"] as const;
type Status = (typeof statuses)[number];

type ManualOrderItemInput = { productId?: unknown; description?: unknown; quantity?: unknown; unitPriceCents?: unknown; variantLabel?: unknown; color?: unknown };

function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await env.DB.prepare(`
      SELECT o.id, o.customer_name, o.customer_phone, o.delivery_mode, o.address, o.city, o.state, o.postal_code,
        o.subtotal_cents, o.discount_cents, o.shipping_cents, o.total_cents, o.status, o.created_at,
        (SELECT json_group_array(json_object('name', i.product_name, 'quantity', i.quantity, 'size', i.size, 'color', i.color, 'unitPriceCents', i.unit_price_cents)) FROM order_items i WHERE i.order_id = o.id) AS items_json
      FROM orders o ORDER BY o.created_at DESC LIMIT 100
    `).all<{
      id: string; customer_name: string; customer_phone: string; delivery_mode: "delivery" | "pickup"; address: string; city: string; state: string; postal_code: string;
      subtotal_cents: number; discount_cents: number; shipping_cents: number | null; total_cents: number; status: Status; created_at: string; items_json: string;
    }>();
    const orders = (result.results ?? []).map(({ items_json, ...order }) => ({ ...order, items: JSON.parse(items_json || "[]") }));
    return Response.json({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "orders_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let body: { customerName?: unknown; customerPhone?: unknown; dueDate?: unknown; deliveryMode?: unknown; address?: unknown; city?: unknown; state?: unknown; postalCode?: unknown; items?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
  const deliveryMode = body.deliveryMode === "delivery" ? "delivery" : body.deliveryMode === "pickup" || body.deliveryMode === undefined ? "pickup" : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  const postalCode = typeof body.postalCode === "string" ? body.postalCode.replace(/\D/g, "") : "";
  const validDestination = deliveryMode === "pickup" || (deliveryMode === "delivery" && address.length > 0 && address.length <= 240 && city.length > 0 && city.length <= 100 && /^[A-Z]{2}$/.test(state) && /^\d{8}$/.test(postalCode));
  if (!customerName || customerName.length > 120 || customerPhone.length > 40 || (customerPhone && !/^\+?[\d\s().-]{8,40}$/.test(customerPhone)) || !deliveryMode || !validDestination || (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T12:00:00Z`)) || new Date(`${dueDate}T12:00:00Z`).toISOString().slice(0, 10) !== dueDate)) || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) return Response.json({ error: "invalid_manual_order" }, { status: 400 });

  let catalog: StoreProduct[] = initialCatalog;
  try {
    const stored = await env.DB.prepare("SELECT setting_value FROM store_settings WHERE setting_key = 'catalog'").first<{ setting_value: string }>();
    if (stored) catalog = JSON.parse(stored.setting_value) as StoreProduct[];
  } catch { return Response.json({ error: "catalog_unavailable" }, { status: 503 }); }

  const items = body.items.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as ManualOrderItemInput;
    const description = typeof row.description === "string" ? row.description.trim() : "";
    const quantity = row.quantity;
    if (!description || description.length > 250 || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) return null;
    if (row.productId === undefined || row.productId === "") {
      const unitPriceCents = row.unitPriceCents;
      if (typeof unitPriceCents !== "number" || !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 1 || unitPriceCents > 100_000_000) return null;
      return { productId: `manual-${crypto.randomUUID()}`, name: description, quantity, unitPriceCents, size: typeof row.variantLabel === "string" ? row.variantLabel.trim().slice(0, 60) : "", color: typeof row.color === "string" ? row.color.trim().slice(0, 80) : "" };
    }
    if (typeof row.productId !== "string" || row.productId.length > 100) return null;
    const product = catalog.find((item) => item.id === row.productId && item.isActive !== false);
    const variantLabel = typeof row.variantLabel === "string" ? row.variantLabel.trim() : "";
    const option = product?.sizes.find((size) => size.label === variantLabel);
    const color = typeof row.color === "string" ? row.color.trim() : "";
    if (!product || product.stockQuantity === 0 || !option || (product.colors.length > 0 && !product.colors.includes(color))) return null;
    return { productId: product.id, name: product.name, quantity, unitPriceCents: option.priceCents, size: variantLabel, color };
  });
  if (items.some((item) => item === null)) return Response.json({ error: "invalid_manual_order_items" }, { status: 400 });
  const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
  const totalCents = validItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 1_000_000_000) return Response.json({ error: "invalid_manual_order_total" }, { status: 400 });

  const id = crypto.randomUUID();
  const statements = [
    ...catalog.filter((product) => product.stockQuantity !== undefined).map((product) => env.DB.prepare("INSERT OR IGNORE INTO product_inventory (product_id, stock_quantity, low_stock_threshold) VALUES (?, ?, ?)").bind(product.id, product.stockQuantity, product.lowStockThreshold ?? 0)),
    env.DB.prepare("INSERT INTO orders (id, customer_name, customer_phone, delivery_mode, address, city, state, postal_code, subtotal_cents, discount_cents, shipping_cents, total_cents, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)").bind(id, customerName, customerPhone, deliveryMode, deliveryMode === "delivery" ? address : "", deliveryMode === "delivery" ? city : "", deliveryMode === "delivery" ? state : "", deliveryMode === "delivery" ? postalCode : "", totalCents, totalCents, dueDate || null),
    ...validItems.map((item) => env.DB.prepare("INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, item.productId, item.name, item.unitPriceCents, item.quantity, item.size, item.color)),
  ];
  try {
    await env.DB.batch(statements);
    return Response.json({ id, totalCents, items: validItems }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    try {
      const inventoryItems = validItems.filter((item) => catalog.some((product) => product.id === item.productId && product.stockQuantity !== undefined));
      const quantities = new Map<string, number>();
      inventoryItems.forEach((item) => quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity));
      const ids = [...quantities.keys()];
      if (ids.length) {
        const rows = await env.DB.prepare(`SELECT product_id, stock_quantity FROM product_inventory WHERE product_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ product_id: string; stock_quantity: number }>();
        const available = new Map((rows.results ?? []).map((row) => [row.product_id, row.stock_quantity]));
        if (ids.some((productId) => (available.get(productId) ?? 0) < (quantities.get(productId) ?? 0))) return Response.json({ error: "out_of_stock" }, { status: 409 });
      }
    } catch { /* Keep a generic failure if inventory cannot be read. */ }
    return Response.json({ error: "manual_order_save_failed" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: unknown; status?: unknown };
  try { body = await request.json() as { id?: unknown; status?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.id !== "string" || body.id.length > 64 || typeof body.status !== "string" || !statuses.includes(body.status as Status)) return Response.json({ error: "invalid_order_update" }, { status: 400 });
  try {
    const result = await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(body.status, body.id).run();
    if (!result.meta.changes) return Response.json({ error: "order_not_found" }, { status: 404 });
    return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "order_update_failed" }, { status: 503 });
  }
}
