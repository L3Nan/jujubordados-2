import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

async function rows<T>(query: string) {
  const result = await env.DB.prepare(query).all<T>();
  return result.results ?? [];
}

export async function GET(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const [settings, orders, orderItems, orderPayments, financeEntries, productInventory, metrics] = await Promise.all([
      rows<{ setting_key: string; setting_value: string; updated_at: string }>("SELECT setting_key, setting_value, updated_at FROM store_settings"),
      rows<Record<string, unknown>>("SELECT * FROM orders ORDER BY created_at"),
      rows<Record<string, unknown>>("SELECT * FROM order_items ORDER BY id"),
      rows<Record<string, unknown>>("SELECT * FROM order_payments ORDER BY received_at"),
      rows<Record<string, unknown>>("SELECT * FROM finance_entries ORDER BY entry_date, created_at"),
      rows<Record<string, unknown>>("SELECT * FROM product_inventory ORDER BY product_id"),
      rows<Record<string, unknown>>("SELECT * FROM store_metrics_daily ORDER BY metric_date"),
    ]);
    const backup = {
      format: "jujubordados-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      included: ["configuração e catálogo", "pedidos e itens", "recebimentos", "lançamentos financeiros", "estoque", "métricas agregadas"],
      excluded: ["fotos armazenadas no banco", "inscrições de notificações por dispositivo", "registros técnicos de tentativas de acesso"],
      data: { settings, orders, orderItems, orderPayments, financeEntries, productInventory, metrics },
    };
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jujubordados-backup-${date}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "backup_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
