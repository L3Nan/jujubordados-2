import { env } from "cloudflare:workers";
import { EMPTY_OPERATIONS, parseOperations } from "@/data/store-operations";

export async function GET() {
  try {
    const stored = await env.DB.prepare("SELECT setting_value FROM store_settings WHERE setting_key='operations'").first<{ setting_value: string }>();
    const operations = stored ? parseOperations(stored.setting_value) : EMPTY_OPERATIONS;
    return Response.json({ coupons: operations.coupons.filter((coupon) => coupon.active), shippingRules: operations.shippingRules.filter((rule) => rule.active) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "store_settings_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
