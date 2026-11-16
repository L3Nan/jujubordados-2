import { env } from "cloudflare:workers";
import { categories as initialCategories, products as initialProducts } from "@/data/catalog";

export async function GET() {
  try {
    const rows = await env.DB.prepare("SELECT setting_key, setting_value FROM store_settings WHERE setting_key IN ('catalog', 'categories')").all<{ setting_key: string; setting_value: string }>();
    const values = new Map((rows.results ?? []).map((row) => [row.setting_key, row.setting_value]));
    const products = values.has("catalog") ? JSON.parse(values.get("catalog")!) : initialProducts;
    const categories = values.has("categories") ? JSON.parse(values.get("categories")!) : initialCategories.map((name) => ({ id: `category-${name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`, name, parentId: null }));
    if (!Array.isArray(products) || !Array.isArray(categories)) throw new Error("invalid_catalog");
    return Response.json({ products, categories }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
