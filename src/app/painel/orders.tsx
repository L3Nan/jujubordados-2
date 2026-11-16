"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/data/catalog";

type OrderItem = { name: string; quantity: number; size: string; color: string; unitPriceCents: number };
type Order = {
  id: string; customer_name: string; customer_phone: string; delivery_mode: "delivery" | "pickup"; address: string; city: string; state: string; postal_code: string;
  subtotal_cents: number; discount_cents: number; shipping_cents: number | null; total_cents: number; status: string; created_at: string; items: OrderItem[];
};

const statuses = ["Novo", "Em produção", "Pronto", "Concluído", "Cancelado"];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); setLoading(false); return; }
    if (!response.ok) throw new Error("Não foi possível carregar os pedidos.");
    const data = await response.json() as { orders: Order[] };
    setOrders(data.orders);
    setAuthenticated(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrders().catch(() => { setError("Não foi possível conectar ao banco de pedidos."); setLoading(false); }); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error(response.status === 401 ? "Senha incorreta." : "Não foi possível entrar agora.");
      setPassword(""); await loadOrders();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false); setOrders([]);
  }

  async function updateStatus(order: Order, status: string) {
    setError("");
    try {
      const response = await fetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status }) });
      if (response.status === 401) { setAuthenticated(false); throw new Error("Sua sessão expirou. Entre novamente."); }
      if (!response.ok) throw new Error("Não foi possível atualizar o pedido.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar."); }
  }

  if (loading) return <main className="admin-orders-page"><p role="status">Carregando painel...</p></main>;
  if (!authenticated) return (
    <main className="admin-login-page">
      <Link className="admin-back-link" href="/">← Voltar à vitrine</Link>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <ImageLogo />
        <p className="eyebrow">Acesso da proprietária</p>
        <h1 id="admin-login-title">Painel da loja</h1>
        <p>Entre com a senha administrativa para consultar e atualizar os pedidos recebidos.</p>
        <form onSubmit={signIn}>
          <label htmlFor="admin-password">Senha</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="checkout-error" role="alert">{error}</p>}
          <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar no painel"}<span aria-hidden="true">↗</span></button>
        </form>
      </section>
    </main>
  );

  const newOrders = orders.filter((order) => order.status === "Novo").length;
  return (
    <main className="admin-orders-page">
      <header className="admin-orders-header"><div><Link className="admin-back-link" href="/">← Vitrine</Link><p className="eyebrow">Gestão da loja</p><h1>Pedidos recebidos</h1></div><button className="admin-logout" type="button" onClick={signOut}>Sair</button></header>
      <section className="admin-orders-summary" aria-label="Resumo de pedidos"><article><span>Pedidos registrados</span><strong>{orders.length}</strong></article><article><span>Aguardando atendimento</span><strong>{newOrders}</strong></article></section>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      {orders.length === 0 ? <section className="admin-orders-empty"><span aria-hidden="true">✳</span><h2>Nenhum pedido recebido ainda</h2><p>Quando alguém concluir o checkout, o pedido aparecerá aqui.</p></section> : <div className="admin-orders-list">{orders.map((order) => (
        <article className="admin-order-card" key={order.id}>
          <div className="admin-order-heading"><div><p>Pedido {order.id.slice(0, 8).toUpperCase()}</p><time dateTime={order.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</time></div><label>Status<select value={order.status} onChange={(event) => void updateStatus(order, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
          <div className="admin-order-customer"><strong>{order.customer_name}</strong><a href={`tel:${order.customer_phone.replace(/[^\d+]/g, "")}`}>{order.customer_phone}</a></div>
          <ul className="admin-order-items">{order.items.map((item, index) => <li key={`${order.id}-${index}`}><span>{item.quantity}× {item.name} · {item.size}{item.color ? ` · ${item.color}` : ""}</span><strong>{formatPrice(item.unitPriceCents * item.quantity)}</strong></li>)}</ul>
          <div className="admin-order-delivery"><strong>{order.delivery_mode === "pickup" ? "Retirada" : "Entrega"}</strong>{order.delivery_mode === "delivery" && <span>{order.address}, {order.city}/{order.state} {order.postal_code}</span>}</div>
          <div className="admin-order-total"><span>Total informado</span><strong>{formatPrice(order.total_cents)}</strong></div>
        </article>
      ))}</div>}
    </main>
  );
}

function ImageLogo() {
  return <div className="admin-login-mark" aria-hidden="true">J</div>;
}
