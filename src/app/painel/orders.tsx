"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatPrice, type StoreProduct } from "@/data/catalog";
import type { StoreCategory } from "@/data/store-catalog";
import AdminPanel from "./panel";

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
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [view, setView] = useState<"orders" | "catalog" | "management">("orders");
  const [catalogNotice, setCatalogNotice] = useState("");

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

  useEffect(() => {
    if (!authenticated) return;
    let mounted = true;
    void fetch("/api/store/catalog", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json() as { products: StoreProduct[]; categories: StoreCategory[] };
      if (mounted) { setCatalog(data.products); setCategories(data.categories); }
    }).catch(() => { if (mounted) setCatalogNotice("Não foi possível carregar o catálogo compartilhado."); });
    return () => { mounted = false; };
  }, [authenticated]);

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

  function updateProduct(id: string, update: Partial<StoreProduct>) {
    setCatalog((current) => current.map((product) => product.id === id ? { ...product, ...update } : product));
  }

  async function saveCatalog() {
    setCatalogNotice("Salvando no banco...");
    const response = await fetch("/api/admin/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: catalog, categories }) });
    if (response.status === 401) { setAuthenticated(false); setCatalogNotice("Sessão expirada. Entre novamente."); return; }
    if (!response.ok) { setCatalogNotice("Não foi possível salvar. Confira nomes, categorias, preços e imagens."); return; }
    setCatalogNotice("Catálogo salvo e sincronizado com a vitrine.");
  }

  function addProduct() {
    if (!categories.length) { setCatalogNotice("Cadastre uma categoria antes de adicionar produtos."); return; }
    const id = `bordado-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    setCatalog((current) => [...current, { id, name: "Novo bordado", category: categories[0].name, description: "", image: "/products/touquinha-rn.jpg", images: [], priceCents: 0, availability: "Sob encomenda", sizes: [{ label: "Único", priceCents: 0 }], colors: [], featured: false, isActive: false }]);
    setCatalogNotice("Novo item adicionado. Preencha os dados e salve para publicar.");
  }

  function updateCategory(id: string, name: string) {
    const oldName = categories.find((category) => category.id === id)?.name;
    if (!oldName) return;
    setCategories((current) => current.map((category) => category.id === id ? { ...category, name } : category));
    setCatalog((current) => current.map((product) => product.category === oldName ? { ...product, category: name } : product));
  }

  function addCategory() {
    const id = `categoria-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    setCategories((current) => [...current, { id, name: "Nova categoria", parentId: null }]);
    setCatalogNotice("Categoria adicionada. Ajuste o nome e salve as alterações.");
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
      <header className="admin-orders-header"><div><Link className="admin-back-link" href="/">← Vitrine</Link><p className="eyebrow">Gestão da loja</p><h1>{view === "orders" ? "Pedidos recebidos" : view === "catalog" ? "Catálogo compartilhado" : "Gestão completa"}</h1></div><button className="admin-logout" type="button" onClick={signOut}>Sair</button></header>
      <nav className="admin-orders-tabs" aria-label="Seções do painel"><button type="button" className={view === "orders" ? "selected" : ""} onClick={() => setView("orders")}>Pedidos</button><button type="button" className={view === "catalog" ? "selected" : ""} onClick={() => setView("catalog")}>Produtos e categorias</button><button type="button" className={view === "management" ? "selected" : ""} onClick={() => setView("management")}>Financeiro e ferramentas</button></nav>
      {view === "management" ? <AdminPanel /> : view === "catalog" ? <section className="admin-catalog-editor">
        <div className="admin-catalog-editor-head"><div><p className="eyebrow">Dados publicados na vitrine</p><h2>Produtos</h2></div><button className="button button-dark" type="button" onClick={addProduct}>Adicionar produto <span aria-hidden="true">＋</span></button></div>
        {catalogNotice && <p className="admin-notice" role="status">{catalogNotice}</p>}
        <div className="admin-category-editor"><div className="admin-catalog-editor-head"><h3>Categorias</h3><button type="button" onClick={addCategory}>Adicionar categoria ＋</button></div>{categories.map((category) => <label key={category.id}>Categoria<input value={category.name} maxLength={80} onChange={(event) => updateCategory(category.id, event.target.value)} /></label>)}</div>
        <div className="admin-product-editor-list">{catalog.map((product) => <article className="admin-product-editor" key={product.id}>
          <div className="admin-product-editor-heading"><strong>{product.name}</strong><button type="button" onClick={() => setCatalog((current) => current.filter((item) => item.id !== product.id))}>Remover</button></div>
          <div className="admin-product-editor-fields">
            <label>Nome<input value={product.name} maxLength={160} onChange={(event) => updateProduct(product.id, { name: event.target.value })} /></label>
            <label>Categoria<select value={product.category} onChange={(event) => updateProduct(product.id, { category: event.target.value })}>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label>
            <label>Preço base (R$)<input inputMode="decimal" value={(product.sizes[0]?.priceCents ?? 0) / 100} onChange={(event) => { const value = Number(event.target.value.replace(",", ".")); if (!Number.isFinite(value) || value < 0) return; const priceCents = Math.round(value * 100); updateProduct(product.id, { priceCents, sizes: product.sizes.map((option, index) => index === 0 ? { ...option, priceCents } : option) }); }} /></label>
            <label>Foto (caminho ou URL HTTPS)<input value={product.image} maxLength={1000} onChange={(event) => updateProduct(product.id, { image: event.target.value })} /></label>
            <label>Descrição<textarea value={product.description} maxLength={5000} rows={3} onChange={(event) => updateProduct(product.id, { description: event.target.value })} /></label>
            <label>Disponibilidade<input value={product.availability} maxLength={100} onChange={(event) => updateProduct(product.id, { availability: event.target.value })} /></label>
            <label>Estoque (vazio = sob encomenda)<input type="number" min="0" value={product.stockQuantity ?? ""} onChange={(event) => updateProduct(product.id, { stockQuantity: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
          </div>
          <label className="admin-product-toggle"><input type="checkbox" checked={product.isActive !== false} onChange={(event) => updateProduct(product.id, { isActive: event.target.checked })} /> Publicado na vitrine</label>
        </article>)}</div>
        <button className="button button-rose admin-save-catalog" type="button" onClick={() => void saveCatalog()}>Salvar catálogo compartilhado <span aria-hidden="true">↗</span></button>
      </section> : <>
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
      </>}
    </main>
  );
}

function ImageLogo() {
  return <div className="admin-login-mark" aria-hidden="true">J</div>;
}
