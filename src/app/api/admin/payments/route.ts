import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let body: { orderId?: unknown; paymentId?: unknown; amountCents?: unknown; date?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.orderId !== "string" || !body.orderId || body.orderId.length > 64 || typeof body.paymentId !== "string" || !uuidPattern.test(body.paymentId) || typeof body.amountCents !== "number" || !Number.isSafeInteger(body.amountCents) || body.amountCents < 1 || body.amountCents > 1_000_000_000 || !validDate(body.date)) return Response.json({ error: "invalid_payment" }, { status: 400 });

  const paymentId = body.paymentId;
  const entryId = `FIN-${paymentId}`;
  const receivedAt = new Date().toISOString();
  try {
    const results = await env.DB.batch([
      env.DB.prepare(`INSERT INTO order_payments (id, order_id, amount_cents, received_at)
        SELECT ?, o.id, ?, ? FROM orders o
        WHERE o.id = ? AND o.status <> 'Cancelado'
          AND COALESCE((SELECT SUM(p.amount_cents) FROM order_payments p WHERE p.order_id = o.id), 0) + ? <= o.total_cents`)
        .bind(paymentId, body.amountCents, receivedAt, body.orderId, body.amountCents),
      env.DB.prepare(`INSERT INTO finance_entries (id, kind, category, description, amount_cents, entry_date, related_order_id, related_payment_id)
        SELECT ?, 'income', 'Vendas', ?, amount_cents, ?, order_id, id FROM order_payments WHERE id = ? AND order_id = ?`)
        .bind(entryId, `Recebimento do pedido ${body.orderId}`, body.date, paymentId, body.orderId),
      env.DB.prepare(`UPDATE orders SET payment_status = CASE
        WHEN COALESCE((SELECT SUM(p.amount_cents) FROM order_payments p WHERE p.order_id = orders.id), 0) >= total_cents THEN 'Pago'
        ELSE 'Parcial' END WHERE id = ? AND EXISTS (SELECT 1 FROM order_payments p WHERE p.id = ? AND p.order_id = orders.id)`)
        .bind(body.orderId, paymentId),
    ]);
    if (!results[0]?.meta.changes) {
      const order = await env.DB.prepare("SELECT status, total_cents, (SELECT COALESCE(SUM(amount_cents), 0) FROM order_payments WHERE order_id = orders.id) AS paid_cents FROM orders WHERE id = ?")
        .bind(body.orderId).first<{ status: string; total_cents: number; paid_cents: number }>();
      if (!order) return Response.json({ error: "order_not_found" }, { status: 404 });
      if (order.status === "Cancelado") return Response.json({ error: "cancelled_order" }, { status: 409 });
      return Response.json({ error: "payment_exceeds_balance", remainingCents: Math.max(0, order.total_cents - order.paid_cents) }, { status: 409 });
    }
    const paid = await env.DB.prepare("SELECT payment_status, total_cents, (SELECT COALESCE(SUM(amount_cents), 0) FROM order_payments WHERE order_id = orders.id) AS paid_cents FROM orders WHERE id = ?")
      .bind(body.orderId).first<{ payment_status: "Pendente" | "Parcial" | "Pago"; total_cents: number; paid_cents: number }>();
    return Response.json({
      payment: { id: paymentId, amountCents: body.amountCents, receivedAt },
      entry: { id: entryId, kind: "income", category: "Vendas", description: `Recebimento do pedido ${body.orderId}`, amountCents: body.amountCents, date: body.date, relatedOrderId: body.orderId },
      paymentStatus: paid?.payment_status ?? "Parcial",
      remainingCents: Math.max(0, (paid?.total_cents ?? body.amountCents) - (paid?.paid_cents ?? body.amountCents)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    try {
      const existing = await env.DB.prepare(`SELECT p.order_id, p.amount_cents, p.received_at, f.id AS entry_id, f.category, f.description, f.entry_date, o.payment_status, o.total_cents,
        (SELECT COALESCE(SUM(other.amount_cents), 0) FROM order_payments other WHERE other.order_id = o.id) AS paid_cents
        FROM order_payments p JOIN finance_entries f ON f.related_payment_id = p.id JOIN orders o ON o.id = p.order_id WHERE p.id = ?`).bind(paymentId)
        .first<{ order_id: string; amount_cents: number; received_at: string; entry_id: string; category: string; description: string; entry_date: string; payment_status: "Pendente" | "Parcial" | "Pago"; total_cents: number; paid_cents: number }>();
      if (existing && existing.order_id === body.orderId && existing.amount_cents === body.amountCents) {
        return Response.json({
          payment: { id: paymentId, amountCents: existing.amount_cents, receivedAt: existing.received_at },
          entry: { id: existing.entry_id, kind: "income", category: existing.category, description: existing.description, amountCents: existing.amount_cents, date: existing.entry_date, relatedOrderId: existing.order_id },
          idempotent: true,
          paymentStatus: existing.payment_status,
          remainingCents: Math.max(0, existing.total_cents - existing.paid_cents),
        }, { headers: { "Cache-Control": "no-store" } });
      }
    } catch { /* Return the transactional write failure below. */ }
    return Response.json({ error: "payment_save_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
