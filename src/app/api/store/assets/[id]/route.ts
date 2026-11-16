import { env } from "cloudflare:workers";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  try {
    const asset = await env.DB.prepare("SELECT content_type, image_data FROM store_assets WHERE id=?").bind(id).first<{ content_type: string; image_data: ArrayBuffer | Uint8Array }>();
    if (!asset || asset.content_type !== "image/webp") return new Response(null, { status: 404 });
    const body = asset.image_data instanceof Uint8Array ? asset.image_data : new Uint8Array(asset.image_data);
    const imageBuffer = new ArrayBuffer(body.byteLength);
    new Uint8Array(imageBuffer).set(body);
    return new Response(imageBuffer, { headers: { "Content-Type": "image/webp", "Content-Length": String(body.byteLength), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
