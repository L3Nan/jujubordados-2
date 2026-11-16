import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let body: { kind?: unknown; category?: unknown; description?: unknown; amountCents?: unknown; date?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (!(["income", "expense"] as unknown[]).includes(body.kind) || typeof body.category !== "string" || !body.category.trim() || body.category.length > 100 || typeof body.description !== "string" || !body.description.trim() || body.description.length > 500 || typeof body.amountCents !== "number" || !Number.isSafeInteger(body.amountCents) || body.amountCents < 1 || body.amountCents > 1_000_000_000 || !validDate(body.date)) return Response.json({ error: "invalid_finance_entry" }, { status: 400 });
  const entry = { id: crypto.randomUUID(), kind: body.kind as "income" | "expense", category: body.category.trim(), description: body.description.trim(), amountCents: body.amountCents, date: body.date };
  try {
    await env.DB.prepare("INSERT INTO finance_entries (id, kind, category, description, amount_cents, entry_date) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(entry.id, entry.kind, entry.category, entry.description, entry.amountCents, entry.date).run();
    return Response.json({ entry }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "finance_save_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
