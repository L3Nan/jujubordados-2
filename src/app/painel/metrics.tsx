"use client";

import { useEffect, useState } from "react";

type MetricDay = { date: string; visits: number; whatsappClicks: number; orders: number };
type MetricsData = { days: number; series: MetricDay[]; totals: Omit<MetricDay, "date">; conversionRate: number };

const emptyMetrics: MetricsData = { days: 30, series: [], totals: { visits: 0, whatsappClicks: 0, orders: 0 }, conversionRate: 0 };

export default function StoreMetrics() {
  const [days, setDays] = useState<7 | 30>(30);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/metrics?days=${days}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Não foi possível carregar os dados deste período.");
      const data = await response.json() as MetricsData;
      if (active) { setMetrics(data); setError(""); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Falha ao consultar as métricas.");
    });
    return () => { active = false; };
  }, [days]);

  const peak = Math.max(1, ...metrics.series.flatMap((day) => [day.visits, day.whatsappClicks, day.orders]));
  const conversion = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(metrics.conversionRate);

  return (
    <section className="admin-catalog store-metrics-section" id="metrics" aria-labelledby="metrics-title">
      <div className="admin-section-head"><div><p className="eyebrow">MOVIMENTO DA VITRINE</p><h2 id="metrics-title">Métricas e relatórios</h2><p>Visitas, saídas para o WhatsApp, pedidos e conversão no período.</p></div><label className="metrics-period">Período<select value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30)}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label></div>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      <div className="admin-metrics metrics-summary"><article><span>Visitas</span><strong>{metrics.totals.visits}</strong><small>Aberturas da vitrine</small></article><article><span>Cliques no WhatsApp</span><strong>{metrics.totals.whatsappClicks}</strong><small>Após registrar um pedido</small></article><article><span>Pedidos enviados</span><strong>{metrics.totals.orders}</strong><small>Pedidos da vitrine no banco</small></article><article><span>Conversão</span><strong>{conversion}</strong><small>Pedidos ÷ visitas</small></article></div>
      <div className="metric-chart-legend" aria-hidden="true"><span><i className="visits" /> Visitas</span><span><i className="whatsapp" /> WhatsApp</span><span><i className="orders" /> Pedidos</span></div>
      {metrics.series.length > 0 && <div className="metric-chart" role="list" aria-label={`Gráfico diário dos últimos ${days} dias`}>
        {metrics.series.map((day) => <div className="metric-chart-day" role="listitem" aria-label={`${new Date(`${day.date}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })}: ${day.visits} visitas, ${day.whatsappClicks} cliques no WhatsApp, ${day.orders} pedidos`} key={day.date}>
          <div className="metric-chart-bars" aria-hidden="true">{([[day.visits, "visits"], [day.whatsappClicks, "whatsapp"], [day.orders, "orders"]] as const).map(([count, type]) => <span className={type} key={type} style={{ height: `${count ? Math.max(4, count / peak * 100) : 1}%` }} />)}</div>
          <small>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: days === 7 ? "short" : undefined, timeZone: "UTC" })}</small>
        </div>)}
      </div>}
      <p className="admin-footnote">Cada abertura conta como uma visita; visitas repetidas não são deduplicadas. Os eventos não guardam IP, cookies de análise ou dados pessoais. As métricas começam a contar após esta publicação.</p>
    </section>
  );
}
