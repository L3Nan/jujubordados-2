import { env } from "cloudflare:workers";
import { adminCookie, adminLoginRateLimitKey, clearAdminCookie, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 5;

function isSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { password?: unknown };
  try { body = await request.json() as { password?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.password !== "string" || body.password.length > 256) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  const clientIp = request.headers.get("CF-Connecting-IP");
  let rateLimitKey: string | null = null;
  if (clientIp) {
    try {
      rateLimitKey = await adminLoginRateLimitKey(clientIp);
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("DELETE FROM admin_login_attempts WHERE window_started_at < ?").bind(now - 86400).run();
      const attempt = await env.DB.prepare(`INSERT INTO admin_login_attempts (ip_hash, window_started_at, attempt_count) VALUES (?, ?, 1)
        ON CONFLICT(ip_hash) DO UPDATE SET
          attempt_count = CASE WHEN ? - admin_login_attempts.window_started_at >= ? THEN 1 ELSE admin_login_attempts.attempt_count + 1 END,
          window_started_at = CASE WHEN ? - admin_login_attempts.window_started_at >= ? THEN ? ELSE admin_login_attempts.window_started_at END
        RETURNING attempt_count, window_started_at`).bind(rateLimitKey, now, now, LOGIN_WINDOW_SECONDS, now, LOGIN_WINDOW_SECONDS, now).first<{ attempt_count: number; window_started_at: number }>();
      if (attempt && attempt.attempt_count > MAX_LOGIN_ATTEMPTS) {
        const retryAfter = Math.max(1, attempt.window_started_at + LOGIN_WINDOW_SECONDS - now);
        return Response.json({ error: "too_many_attempts" }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } });
      }
    } catch {
      return Response.json({ error: "login_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (!await verifyAdminPassword(body.password)) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (rateLimitKey) await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(rateLimitKey).run();
  const response = Response.json({ authenticated: true });
  response.headers.set("Set-Cookie", adminCookie(await createAdminSession()));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const response = Response.json({ authenticated: false });
  response.headers.set("Set-Cookie", clearAdminCookie());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
