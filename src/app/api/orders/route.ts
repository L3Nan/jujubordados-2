import { env } from "cloudflare:workers";
import { randomUUID } from "node:crypto";
import { products as catalog } from "@/data/catalog";

export const runtime = "edge";

type OrderInput = {
  customerName?: unknown;
  customerPhone?: unknown;
  deliveryMode?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  subtotalCents?: unknown;
  discountCents?: unknown;
  shippingCents?: unknown;
  totalCents?: unknown;
  couponCode?: unknown;
  items?: unknown;
};

function text(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cents(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function POST(request: Request) {
  let input: OrderInput;
  try {
    input = await request.json() as OrderInput;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const customerName = text(input.customerName, 120);
  const customerPhone = text(input.customerPhone, 32);
  const deliveryMode = input.deliveryMode === "pickup" ? "pickup" : input.deliveryMode === "delivery" ? "delivery" : "";
  const subtotalCents = cents(input.subtotalCents);
  const discountCents = cents(input.discountCents);
  const totalCents = cents(input.totalCents);
  const shippingCents = input.shippingCents === null ? null : cents(input.shippingCents);
  const items = Array.isArray(input.items) ? input.items : [];

  if (!customerName || !/^\+?[\d\s().-]{8,32}$/.test(customerPhone) || !deliveryMode || subtotalCents === null || discountCents === null || totalCents === null || (input.shippingCents !== null && shippingCents === null) || items.length < 1 || items.length > 30) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }

  const parsedItems = items.map((item) => {
    if (typeof item !== "object" || item === null) return null;
    const row = item as Record<string, unknown>;
    const requestedPriceCents = cents(row.unitPriceCents);
    const quantity = row.quantity;
    const productId = text(row.productId, 100);
    const product = catalog.find((entry) => entry.id === productId && entry.isActive !== false);
    const size = text(row.size, 60);
    const option = product?.sizes.find((entry) => entry.label === size);
    if (!product || product.stockQuantity === 0 || !option || requestedPriceCents !== option.priceCents || text(row.name, 160) !== product.name || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || (product.stockQuantity !== undefined && product.stockQuantity > 0 && quantity > product.stockQuantity)) return null;
    const color = text(row.color, 80);
    if (product.colors.length && !product.colors.includes(color)) return null;
    return { productId, name: product.name, unitPriceCents: option.priceCents, quantity, size, color };
  });

  if (parsedItems.some((item) => item === null)) return Response.json({ error: "invalid_order_items" }, { status: 400 });
  const normalizedItems = parsedItems.filter((item): item is NonNullable<typeof item> => item !== null);
  const calculatedSubtotal = normalizedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const expectedShipping = deliveryMode === "pickup" ? 0 : null;
  const expectedTotal = calculatedSubtotal - discountCents + (shippingCents ?? 0);
  if (calculatedSubtotal !== subtotalCents || discountCents !== 0 || shippingCents !== expectedShipping || totalCents !== expectedTotal || (deliveryMode === "delivery" && (!text(input.address, 240) || !text(input.city, 100) || !/^[a-z]{2}$/i.test(text(input.state, 2)))) ) {
    return Response.json({ error: "invalid_order_total" }, { status: 400 });
  }

  const id = randomUUID();
  const statements = [
    env.DB.prepare("INSERT INTO orders (id, customer_name, customer_phone, delivery_mode, address, city, state, postal_code, subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
      id, customerName, customerPhone, deliveryMode, deliveryMode === "delivery" ? text(input.address, 240) : "", deliveryMode === "delivery" ? text(input.city, 100) : "", deliveryMode === "delivery" ? text(input.state, 2).toUpperCase() : "", deliveryMode === "delivery" ? text(input.postalCode, 8).replace(/\D/g, "") : "", subtotalCents, discountCents, shippingCents, totalCents, text(input.couponCode, 40) || null,
    ),
    ...normalizedItems.map((item) => env.DB.prepare("INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, item.productId, item.name, item.unitPriceCents, item.quantity, item.size, item.color)),
  ];

  try {
    await env.DB.batch(statements);
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json({ error: "order_save_failed" }, { status: 503 });
  }
}
