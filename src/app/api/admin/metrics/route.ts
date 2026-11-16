import { env } from "cloudflare:workers";
import { isAdminSession } from "@/lib/admin-auth";

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  if (!await isAdminSession(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const requestedDays = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = requestedDays === 7 ? 7 : 30;
  const endDate = saoPauloDate();
  const startDate = addDays(endDate, -(days - 1));

  try {
    const [metrics, orders] = await Promise.all([
      env.DB.prepare("SELECT metric_date, metric_key, event_count FROM store_metrics_daily WHERE metric_date BETWEEN ? AND ?").bind(startDate, endDate).all<{ metric_date: string; metric_key: "visit" | "whatsapp_click"; event_count: number }>(),
      env.DB.prepare("SELECT date(created_at, '-3 hours') AS metric_date, COUNT(*) AS order_count FROM orders WHERE date(created_at, '-3 hours') BETWEEN ? AND ? GROUP BY date(created_at, '-3 hours')").bind(startDate, endDate).all<{ metric_date: string; order_count: number }>(),
    ]);
    const byDate = new Map<string, { visits: number; whatsappClicks: number; orders: number }>();
    for (let offset = 0; offset < days; offset += 1) byDate.set(addDays(startDate, offset), { visits: 0, whatsappClicks: 0, orders: 0 });
    for (const row of metrics.results ?? []) {
      const daily = byDate.get(row.metric_date);
      if (daily) daily[row.metric_key === "visit" ? "visits" : "whatsappClicks"] = row.event_count;
    }
    for (const row of orders.results ?? []) {
      const daily = byDate.get(row.metric_date);
      if (daily) daily.orders = row.order_count;
    }
    const series = [...byDate].map(([date, counts]) => ({ date, ...counts }));
    const totals = series.reduce((sum, day) => ({ visits: sum.visits + day.visits, whatsappClicks: sum.whatsappClicks + day.whatsappClicks, orders: sum.orders + day.orders }), { visits: 0, whatsappClicks: 0, orders: 0 });
    return Response.json({ days, series, totals, conversionRate: totals.visits ? totals.orders / totals.visits : 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "metrics_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
