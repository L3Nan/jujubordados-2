import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";
import type { StoreProduct } from "@/data/catalog";
import type { StoreCategory } from "@/data/store-catalog";

function validProducts(value: unknown, categories: StoreCategory[]): value is StoreProduct[] {
  if (!Array.isArray(value) || value.length > 150) return false;
  const categoryNames = new Set(categories.map((category) => category.name));
  const ids = new Set<string>();
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const product = item as StoreProduct;
    if (typeof product.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(product.id) || ids.has(product.id)) return false;
    ids.add(product.id);
    if (typeof product.name !== "string" || !product.name.trim() || product.name.length > 160 || typeof product.category !== "string" || !categoryNames.has(product.category) || typeof product.description !== "string" || product.description.length > 5000) return false;
    if (typeof product.image !== "string" || product.image.length > 1000 || (!product.image.startsWith("/") && !product.image.startsWith("https://"))) return false;
    if (product.images !== undefined && (!Array.isArray(product.images) || product.images.length > 12 || product.images.some((image) => typeof image !== "string" || image.length > 1000 || (!image.startsWith("/") && !image.startsWith("https://"))))) return false;
    if (!Array.isArray(product.sizes) || product.sizes.length < 1 || product.sizes.length > 30 || product.sizes.some((option) => !option || typeof option.label !== "string" || option.label.length > 60 || !Number.isSafeInteger(option.priceCents) || option.priceCents < 0 || option.priceCents > 100_000_000)) return false;
    if (!Array.isArray(product.colors) || product.colors.length > 40 || product.colors.some((color) => typeof color !== "string" || color.length > 80)) return false;
    if (typeof product.featured !== "boolean" || (product.isActive !== undefined && typeof product.isActive !== "boolean")) return false;
    if (product.stockQuantity !== undefined && (!Number.isSafeInteger(product.stockQuantity) || product.stockQuantity < 0)) return false;
    if (product.productionDays !== undefined && (!Number.isSafeInteger(product.productionDays) || product.productionDays < 0 || product.productionDays > 365)) return false;
    return true;
  });
}

function validCategories(value: unknown): value is StoreCategory[] {
  if (!Array.isArray(value) || value.length > 60) return false;
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const category = item as StoreCategory;
    if (typeof category.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(category.id) || ids.has(category.id) || typeof category.name !== "string" || !category.name.trim() || category.name.length > 80 || (category.parentId !== null && typeof category.parentId !== "string")) return false;
    if (names.has(category.name.toLocaleLowerCase("pt-BR"))) return false;
    ids.add(category.id); names.add(category.name.toLocaleLowerCase("pt-BR"));
  }
  return value.every((item) => !item.parentId || value.some((parent) => parent.id === item.parentId && parent.parentId === null));
}

export async function PUT(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 600_000) return Response.json({ error: "catalog_too_large" }, { status: 413 });
  let body: { products?: unknown; categories?: unknown };
  try { body = await request.json() as { products?: unknown; categories?: unknown }; } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (!validCategories(body.categories) || !validProducts(body.products, body.categories)) return Response.json({ error: "invalid_catalog" }, { status: 400 });
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 600_000) return Response.json({ error: "catalog_too_large" }, { status: 413 });
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO store_settings (setting_key, setting_value, updated_at) VALUES ('catalog', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at").bind(JSON.stringify(body.products)),
      env.DB.prepare("INSERT INTO store_settings (setting_key, setting_value, updated_at) VALUES ('categories', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at").bind(JSON.stringify(body.categories)),
    ]);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "catalog_save_failed" }, { status: 503 });
  }
}
