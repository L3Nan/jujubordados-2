import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

const MAX_IMAGE_BYTES = 400 * 1024;

export async function POST(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES + 32_000) return Response.json({ error: "image_too_large" }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.type !== "image/webp" || file.size <= 0 || file.size > MAX_IMAGE_BYTES) return Response.json({ error: "invalid_image" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const riff = String.fromCharCode(...bytes.subarray(0, 4));
    const webp = String.fromCharCode(...bytes.subarray(8, 12));
    if (riff !== "RIFF" || webp !== "WEBP") return Response.json({ error: "invalid_image_content" }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO store_assets (id, content_type, image_data, byte_length) VALUES (?, 'image/webp', ?, ?)").bind(id, bytes, bytes.byteLength).run();
    return Response.json({ src: `/api/store/assets/${id}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "image_save_failed" }, { status: 503 });
  }
}
