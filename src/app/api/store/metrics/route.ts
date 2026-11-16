import { env } from "cloudflare:workers";

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) return Response.json({ error: "same_origin_required" }, { status: 403 });
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "same_origin_required" }, { status: 403 });
  } catch {
    return Response.json({ error: "same_origin_required" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 1024) return Response.json({ error: "payload_too_large" }, { status: 413 });

  let body: { event?: unknown };
  try { body = await request.json() as { event?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (body.event !== "visit" && body.event !== "whatsapp_click") return Response.json({ error: "invalid_event" }, { status: 400 });

  try {
    await env.DB.prepare("INSERT INTO store_metrics_daily (metric_date, metric_key, event_count) VALUES (?, ?, 1) ON CONFLICT(metric_date, metric_key) DO UPDATE SET event_count=event_count+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").bind(saoPauloDate(), body.event).run();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "metrics_unavailable" }, { status: 503 });
  }
}
