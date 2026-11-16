import { env } from "cloudflare:workers";
import { categories as initialCategories, products as initialProducts, storeProfile } from "@/data/catalog";

export async function GET() {
  try {
    const rows = await env.DB.prepare("SELECT setting_key, setting_value FROM store_settings WHERE setting_key IN ('catalog', 'categories', 'profile')").all<{ setting_key: string; setting_value: string }>();
    const values = new Map((rows.results ?? []).map((row) => [row.setting_key, row.setting_value]));
    const products = values.has("catalog") ? JSON.parse(values.get("catalog")!) : initialProducts;
    const categories = values.has("categories") ? JSON.parse(values.get("categories")!) : initialCategories.map((name) => ({ id: `category-${name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`, name, parentId: null }));
    const storedProfile = values.has("profile") ? JSON.parse(values.get("profile")!) as Partial<typeof storeProfile> : {};
    const profile = { ...storeProfile, ...storedProfile };
    if (!Array.isArray(products) || !Array.isArray(categories)) throw new Error("invalid_catalog");
    const inventory = await env.DB.prepare("SELECT product_id, stock_quantity FROM product_inventory").all<{ product_id: string; stock_quantity: number }>();
    const stockByProduct = new Map((inventory.results ?? []).map((row) => [row.product_id, row.stock_quantity]));
    const currentProducts = products.map((product: (typeof initialProducts)[number]) => stockByProduct.has(product.id) ? { ...product, stockQuantity: stockByProduct.get(product.id) } : product);
    return Response.json({ products: currentProducts, categories, profile }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "catalog_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
