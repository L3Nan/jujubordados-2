import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

export const runtime = "edge";

function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const configured = Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  try {
    const result = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").first<{ count: number }>();
    return Response.json({ configured, subscriptions: result?.count ?? 0, publicKey: configured ? env.VAPID_PUBLIC_KEY : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "push_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { subscription?: unknown };
  try { body = await request.json() as { subscription?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const subscription = body.subscription;
  if (typeof subscription !== "object" || subscription === null) return Response.json({ error: "invalid_subscription" }, { status: 400 });
  const value = subscription as Record<string, unknown>;
  const keys = value.keys as Record<string, unknown> | undefined;
  if (typeof value.endpoint !== "string" || value.endpoint.length > 2048 || !value.endpoint.startsWith("https://") || typeof keys?.p256dh !== "string" || keys.p256dh.length > 256 || typeof keys.auth !== "string" || keys.auth.length > 256) return Response.json({ error: "invalid_subscription" }, { status: 400 });
  try {
    await env.DB.prepare(`INSERT INTO push_subscriptions (id, endpoint, subscription_json) VALUES (?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).bind(crypto.randomUUID(), value.endpoint, JSON.stringify(subscription)).run();
    return Response.json({ subscribed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "push_save_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { endpoint?: unknown };
  try { body = await request.json() as { endpoint?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.endpoint !== "string" || body.endpoint.length > 2048 || !body.endpoint.startsWith("https://")) return Response.json({ error: "invalid_endpoint" }, { status: 400 });
  try {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
    return Response.json({ unsubscribed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "push_remove_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
