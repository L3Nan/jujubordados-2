import { adminCookie, clearAdminCookie, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { password?: unknown };
  try { body = await request.json() as { password?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.password !== "string" || body.password.length > 256 || !await verifyAdminPassword(body.password)) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
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
