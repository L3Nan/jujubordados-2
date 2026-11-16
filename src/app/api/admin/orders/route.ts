import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

const statuses = ["Novo", "Em produção", "Pronto", "Concluído", "Cancelado"] as const;
type Status = (typeof statuses)[number];

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
