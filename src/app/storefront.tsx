"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatPrice, products as initialProducts, storeProfile, type StoreProduct } from "@/data/catalog";
import { getCatalogSnapshot, getCategorySnapshot, getServerCatalogSnapshot, getServerCategorySnapshot, parseCategories, saveCatalog, saveCategories, subscribeToCatalog, subscribeToCategories } from "@/data/store-catalog";
import { getOperationsSnapshot, getServerOperationsSnapshot, parseOperations, saveOperations, subscribeToOperations } from "@/data/store-operations";

type CartLine = {
  key: string;
  productId: string;
  name: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
  size: string;
  color: string;
};

const CART_STORAGE_KEY = "jujubordados:cart:v1";
let memoryCartSnapshot = "[]";
const cartListeners = new Set<() => void>();

function getCartSnapshot() {
  if (typeof window === "undefined") return memoryCartSnapshot;
  try {
    memoryCartSnapshot = window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]";
  } catch {
    // Use the in-memory snapshot if the browser blocks local storage.
  }
  return memoryCartSnapshot;
}

function getServerCartSnapshot() {
  return "[]";
}

function subscribeToCart(listener: () => void) {
  cartListeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    cartListeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

function saveCartSnapshot(cart: CartLine[]) {
  const snapshot = JSON.stringify(cart);
  memoryCartSnapshot = snapshot;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, snapshot);
  } catch {
    // Keep the cart usable in this tab if the browser blocks local storage.
  }
  cartListeners.forEach((listener) => listener());
}

function parseCartSnapshot(snapshot: string): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine =>
      typeof line === "object" && line !== null &&
      typeof line.key === "string" && typeof line.productId === "string" &&
      typeof line.name === "string" && typeof line.image === "string" &&
      typeof line.unitPriceCents === "number" && typeof line.quantity === "number" &&
      typeof line.size === "string" && typeof line.color === "string",
    );
  } catch {
    return [];
  }
}

const moneyInputToCents = (value: string) => {
  if (!value.trim()) return null;
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
};

function ProductCard({ product, onChoose }: { product: StoreProduct; onChoose: (product: StoreProduct) => void }) {
  const startingPrice = Math.min(...product.sizes.map((option) => option.priceCents));
  const image = product.images?.[0] ?? product.image;
  const hasOriginalPhotos = Boolean(product.images?.length);

  return (
    <article className="product-card">
      <button className="product-image-button" type="button" onClick={() => onChoose(product)} aria-label={`Ver ${product.name}`}>
        <span className="product-picture">
          <Image src={image} alt={hasOriginalPhotos ? product.name : `Ilustração temporária de ${product.name}`} fill sizes="(max-width: 680px) 90vw, (max-width: 1000px) 44vw, 28vw" unoptimized={image.startsWith("data:")} />
        </span>
        {!hasOriginalPhotos && <span className="illustration-label">Ilustração temporária</span>}
      </button>
      <div className="product-card-copy">
        <p className="product-category">{product.category}</p>
        <h3>{product.name}</h3>
        <p className="product-availability">{product.availabilityNeedsReview ? "Disponibilidade a confirmar" : `${product.availability}${product.productionDays ? ` · ${product.productionDays} dias úteis` : ""}`}</p>
        <div className="product-card-bottom">
          <p className="product-price"><span>{product.priceLabel ? `${product.priceLabel} ` : ""}</span>{formatPrice(startingPrice)}</p>
          <button className="text-button" type="button" onClick={() => onChoose(product)}>Ver detalhes <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </article>
  );
}

export default function Storefront() {
  const catalogSnapshot = useSyncExternalStore(subscribeToCatalog, getCatalogSnapshot, getServerCatalogSnapshot);
  const products = useMemo<StoreProduct[]>(() => {
    try {
      const parsed: unknown = JSON.parse(catalogSnapshot);
      return Array.isArray(parsed) ? parsed as StoreProduct[] : initialProducts;
    } catch {
      return initialProducts;
    }
  }, [catalogSnapshot]);
  const categorySnapshot = useSyncExternalStore(subscribeToCategories, getCategorySnapshot, getServerCategorySnapshot);
  const storeCategories = useMemo(() => parseCategories(categorySnapshot), [categorySnapshot]);
  const productDialog = useRef<HTMLDialogElement>(null);
  const cartDialog = useRef<HTMLDialogElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos os produtos");
  const [categoryCopiedId, setCategoryCopiedId] = useState("");
  const [shareFallbackLink, setShareFallbackLink] = useState("");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const cartSnapshot = useSyncExternalStore(subscribeToCart, getCartSnapshot, getServerCartSnapshot);
  const cart = useMemo(() => parseCartSnapshot(cartSnapshot), [cartSnapshot]);
  const operationsSnapshot = useSyncExternalStore(subscribeToOperations, getOperationsSnapshot, getServerOperationsSnapshot);
  const activeCoupons = useMemo(() => parseOperations(operationsSnapshot).coupons.filter((coupon) => coupon.active), [operationsSnapshot]);
  const activeShippingRules = useMemo(() => parseOperations(operationsSnapshot).shippingRules.filter((rule) => rule.active), [operationsSnapshot]);
  const [copied, setCopied] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponId, setAppliedCouponId] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [customerCep, setCustomerCep] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState("");

  useEffect(() => {
    void fetch("/api/store/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "visit" }), keepalive: true }).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/store/catalog", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { products?: unknown; categories?: unknown };
      if (!mounted || !Array.isArray(data.products) || !Array.isArray(data.categories)) return;
      saveCatalog(data.products as StoreProduct[]);
      saveCategories(data.categories as ReturnType<typeof parseCategories>);
    }).catch(() => { /* Keep the bundled catalog if the shared database is temporarily unavailable. */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/store/operations", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { coupons?: unknown; shippingRules?: unknown };
      if (!mounted || !Array.isArray(data.coupons) || !Array.isArray(data.shippingRules)) return;
      const current = parseOperations(getOperationsSnapshot());
      saveOperations({ ...current, coupons: data.coupons as typeof current.coupons, shippingRules: data.shippingRules as typeof current.shippingRules });
    }).catch(() => { /* Keep local default settings if the shared database is unavailable. */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (selectedProduct) productDialog.current?.showModal();
    else if (productDialog.current?.open) productDialog.current.close();
  }, [selectedProduct]);

  useEffect(() => {
    const applySharedLink = () => {
      const params = new URLSearchParams(window.location.search);
      const categoryId = params.get("categoria");
      if (categoryId) {
        const category = storeCategories.find((item) => item.id === categoryId);
        if (category) {
          setActiveCategory(category.name);
          window.setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }), 0);
        }
        return;
      }
      const productId = window.location.hash.startsWith("#produto-") ? window.location.hash.slice("#produto-".length) : "";
      if (productId) {
        const product = products.find((item) => item.id === productId && item.isActive !== false && item.stockQuantity !== 0);
        if (product) chooseProduct(product);
      }
    };
    applySharedLink();
    window.addEventListener("hashchange", applySharedLink);
    window.addEventListener("popstate", applySharedLink);
    return () => {
      window.removeEventListener("hashchange", applySharedLink);
      window.removeEventListener("popstate", applySharedLink);
    };
  }, [storeCategories, products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const min = moneyInputToCents(minPrice);
    const max = moneyInputToCents(maxPrice);

    return products.filter((product) => {
      if (product.isActive === false || product.stockQuantity === 0) return false;
      const price = Math.min(...product.sizes.map((option) => option.priceCents));
      const matchesCategory = activeCategory === "Todos os produtos" || product.category === activeCategory || product.subcategory === activeCategory;
      const matchesSearch = !normalizedSearch || `${product.name} ${product.description} ${product.category} ${product.subcategory ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      return matchesCategory && matchesSearch && (min === null || price >= min) && (max === null || price <= max);
    });
  }, [products, activeCategory, maxPrice, minPrice, search]);
  const featuredProducts = useMemo(() => products.filter((product) => product.featured && product.isActive !== false && product.stockQuantity !== 0), [products]);

  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);
  const totalPriceCents = cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const appliedCoupon = activeCoupons.find((coupon) => coupon.id === appliedCouponId);
  const couponDiscountCents = appliedCoupon ? Math.min(totalPriceCents, appliedCoupon.discountType === "percentage" ? Math.round(totalPriceCents * appliedCoupon.amount / 100) : appliedCoupon.amount) : 0;
  const checkoutTotalCents = totalPriceCents - couponDiscountCents;
  const normalizedCep = customerCep.replace(/\D/g, "");
  const matchedShippingRule = deliveryMode === "delivery" ? [...activeShippingRules].sort((a, b) => {
    const specificity: Record<typeof a.matchType, number> = { cep: 0, city: 1, state: 2, region: 3 };
    return specificity[a.matchType] - specificity[b.matchType] || (b.matchValue.replace(/\D/g, "").length - a.matchValue.replace(/\D/g, "").length);
  }).find((rule) => {
    const value = rule.matchValue.trim();
    if (rule.matchType === "cep") {
      const target = value.replace(/\D/g, "");
      if (target.length === 8) return normalizedCep === target;
      const prefix = value.replace(/\D/g, "");
      return prefix.length > 0 && normalizedCep.startsWith(prefix);
    }
    if (rule.matchType === "city") return customerCity.trim().localeCompare(value, "pt-BR", { sensitivity: "base" }) === 0;
    if (rule.matchType === "state") return customerState.trim().localeCompare(value, "pt-BR", { sensitivity: "base" }) === 0;
    return value.toLocaleLowerCase("pt-BR") === customerState.trim().toLocaleLowerCase("pt-BR") || value.toLocaleLowerCase("pt-BR") === customerCity.trim().toLocaleLowerCase("pt-BR");
  }) : undefined;
  const shippingCents = deliveryMode === "pickup" ? 0 : matchedShippingRule?.priceCents;
  const selectedOption = selectedProduct?.sizes.find((option) => option.label === selectedSize) ?? selectedProduct?.sizes[0];
  const selectedProductImages = selectedProduct?.images?.length ? selectedProduct.images : selectedProduct ? [selectedProduct.image] : [];
  const selectedPriceCents = selectedOption?.priceCents ?? 0;

  function updateCart(change: (current: CartLine[]) => CartLine[]) {
    const nextCart = change(cart);
    saveCartSnapshot(nextCart);
    if (nextCart.length === 0 && appliedCouponId) {
      setAppliedCouponId("");
      setCouponInput("");
      setCouponMessage("");
    }
  }

  function chooseProduct(product: StoreProduct) {
    setSelectedProduct(product);
    setSelectedSize(product.sizes[0]?.label ?? "");
    setSelectedColor(product.colors[0] ?? "");
    setSelectedImageIndex(0);
    setQuantity(1);
    setCopied(false);
    setShareFallbackLink("");
  }

  function addToCart() {
    if (!selectedProduct || !selectedOption) return;
    const key = `${selectedProduct.id}:${selectedOption.label}:${selectedColor}`;
    updateCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + quantity } : line);
      return [...current, {
        key,
        productId: selectedProduct.id,
        name: selectedProduct.name,
        image: selectedProductImages[selectedImageIndex] ?? selectedProduct.image,
        unitPriceCents: selectedOption.priceCents,
        quantity,
        size: selectedOption.label,
        color: selectedColor,
      }];
    });
    setSelectedProduct(null);
    setTimeout(() => setCartDialogOpen(true), 0);
  }

  function setCartDialogOpen(open: boolean) {
    if (open) cartDialog.current?.showModal();
    else cartDialog.current?.close();
  }

  function updateQuantity(key: string, delta: number) {
    updateCart((current) => current.flatMap((line) => {
      if (line.key !== key) return [line];
      const nextQuantity = line.quantity + delta;
      return nextQuantity > 0 ? [{ ...line, quantity: nextQuantity }] : [];
    }));
  }

  function buildWhatsAppHref() {
    const phone = storeProfile.whatsappNumber.replace(/\D/g, "");
    if (!phone || cart.length === 0) return undefined;
    const lines = cart.map((line) => `• ${line.quantity}× ${line.name} — ${line.size}${line.color ? `, ${line.color}` : ""} — ${formatPrice(line.unitPriceCents * line.quantity)}`);
    const couponLine = appliedCoupon ? `\nCupom ${appliedCoupon.code}: -${formatPrice(couponDiscountCents)}` : "";
    const deliveryLine = deliveryMode === "pickup" ? "Retirada: na loja (combinar horário)" : `Entrega: ${customerAddress}, ${customerCity}/${customerState} · CEP ${customerCep}${matchedShippingRule ? ` · frete ${formatPrice(matchedShippingRule.priceCents)} (${matchedShippingRule.label})` : " · frete a confirmar com a loja"}`;
    const grandTotal = checkoutTotalCents + (shippingCents ?? 0);
    const customerLine = customerName.trim() ? `\nCliente: ${customerName.trim()}${customerPhone.trim() ? ` · ${customerPhone.trim()}` : ""}` : "";
    const message = `Olá! Gostaria de pedir na ${storeProfile.name}:${customerLine}\n\n${lines.join("\n")}\n\nSubtotal: ${formatPrice(totalPriceCents)}${couponLine}\n${deliveryLine}\nTotal estimado: ${formatPrice(grandTotal)}\n\nPode me orientar sobre disponibilidade e entrega?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  async function submitCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return;
    const whatsappHref = buildWhatsAppHref();
    setCheckoutError("");
    setOrderConfirmation("");
    const whatsappWindow = whatsappHref ? window.open("about:blank", "_blank") : null;
    const order = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryMode,
      address: deliveryMode === "delivery" ? customerAddress.trim() : "",
      city: deliveryMode === "delivery" ? customerCity.trim() : "",
      state: deliveryMode === "delivery" ? customerState.trim() : "",
      postalCode: deliveryMode === "delivery" ? normalizedCep : "",
      subtotalCents: totalPriceCents,
      discountCents: couponDiscountCents,
      shippingCents: shippingCents ?? null,
      totalCents: checkoutTotalCents + (shippingCents ?? 0),
      couponCode: appliedCoupon?.code ?? null,
      items: cart.map((line) => ({ productId: line.productId, name: line.name, unitPriceCents: line.unitPriceCents, quantity: line.quantity, size: line.size, color: line.color })),
    };
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
      if (!response.ok) throw new Error("order_rejected");
      const result = await response.json() as { id?: string };
      if (whatsappHref) void fetch("/api/store/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "whatsapp_click" }), keepalive: true }).catch(() => {});
      if (whatsappHref && whatsappWindow) {
        whatsappWindow.opener = null;
        whatsappWindow.location.href = whatsappHref;
      } else if (whatsappWindow) {
        whatsappWindow.close();
      }
      setOrderConfirmation(result.id ? `Pedido ${result.id.slice(0, 8).toUpperCase()} registrado. A loja poderá entrar em contato pelo WhatsApp informado.` : "Pedido registrado com sucesso.");
      updateCart(() => []);
      if (whatsappHref) setCartDialogOpen(false);
    } catch {
      whatsappWindow?.close();
      setCheckoutError("Não foi possível registrar o pedido agora. Confira sua conexão e tente novamente.");
    }
  }

  function applyCoupon() {
    const normalized = couponInput.trim().toLocaleUpperCase("pt-BR");
    const coupon = activeCoupons.find((item) => item.code === normalized);
    if (!normalized) {
      setAppliedCouponId("");
      setCouponMessage("Digite um código de cupom.");
      return;
    }
    if (!coupon) {
      setAppliedCouponId("");
      setCouponMessage("Cupom inválido ou indisponível.");
      return;
    }
    setAppliedCouponId(coupon.id);
    setCouponInput(coupon.code);
    setCouponMessage(`Cupom ${coupon.code} aplicado.`);
  }

  function removeCoupon() {
    setAppliedCouponId("");
    setCouponInput("");
    setCouponMessage("Cupom removido.");
  }

  async function copyProductLink() {
    if (!selectedProduct) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("categoria");
    url.hash = `produto-${selectedProduct.id}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url.toString());
      else if (!copyWithSelection(url.toString())) throw new Error("clipboard_unavailable");
      setCopied(true);
      setShareFallbackLink("");
    } catch {
      setCopied(false);
      setShareFallbackLink(url.toString());
    }
  }

  function copyWithSelection(text: string) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copiedSuccessfully = false;
    try { copiedSuccessfully = document.execCommand("copy"); } catch { copiedSuccessfully = false; }
    field.remove();
    return copiedSuccessfully;
  }

  async function copyCategoryLink(category: (typeof storeCategories)[number]) {
    const url = new URL(window.location.href);
    url.hash = "catalogo";
    url.searchParams.set("categoria", category.id);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url.toString());
      else if (!copyWithSelection(url.toString())) throw new Error("clipboard_unavailable");
      setCategoryCopiedId(category.id);
      setShareFallbackLink("");
      window.setTimeout(() => setCategoryCopiedId(""), 2200);
    } catch {
      setCategoryCopiedId(category.id);
      setShareFallbackLink(url.toString());
    }
  }

  function resetFilters() {
    setActiveCategory("Todos os produtos");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <main>
      <div className="announcement"><span>Feito à mão, com carinho em cada ponto</span></div>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Jujubordados, início">
          <Image className="brand-logo" src="/brand/logo.jpg" alt="" width={44} height={44} priority />
          <span className="brand-name">jujubordados<span className="brand-period">.</span></span>
        </a>
        <nav className="main-nav" aria-label="Navegação principal">
          <a href="#catalogo">Coleção</a>
          <a href="#sobre">O ateliê</a>
        </nav>
        <div className="store-header-actions"><Link href="/painel" className="store-admin-link">Painel <span>↗</span></Link><button className="cart-trigger" type="button" onClick={() => setCartDialogOpen(true)} aria-label={`Abrir sacola, ${totalItems} itens`}>
          Sacola <span className="cart-count">{totalItems}</span>
        </button></div>
      </header>

      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> Ateliê de bordados personalizados</p>
          <h1 id="hero-title">Bordados para<br /><em>momentos únicos.</em></h1>
          <p className="hero-description">{storeProfile.tagline} Peças personalizadas com delicadeza para celebrar as histórias que merecem ficar.</p>
          <div className="hero-actions"><a className="button button-dark" href="#catalogo">Conheça a coleção <span aria-hidden="true">↗</span></a><span>Personalização feita com carinho</span></div>
          <div className="hero-note"><span className="note-line" /> Encontre uma peça para presentear ou guardar</div>
        </div>
        <div className="hero-art">
          <Image src="/products/touquinha-rn-2.jpg" alt="Touquinha RN personalizada com bordado azul" fill priority sizes="(max-width: 760px) 92vw, 44vw" />
          <div className="hero-photo-caption"><span>Uma lembrança para guardar</span><strong>Peças com história</strong></div>
          <span className="hero-art-note" aria-hidden="true">bordado com afeto · Jujubordados</span>
        </div>
      </section>

      <section className="collection" aria-labelledby="collection-title">
        <div className="section-heading">
          <div><p className="eyebrow">Um presente feito com intenção</p><h2 id="collection-title">Peças que guardam <em>histórias.</em></h2></div>
          <p className="section-intro">Conheça os bordados personalizados da Jujubordados e escolha os detalhes da sua peça.</p>
        </div>
        <div className="category-list">
          {storeCategories.filter((category) => !category.parentId).map((category, index) => (
            <div className={`category-card-wrap ${activeCategory === category.name ? "is-active" : ""}`} key={category.id}><button className="category-card" type="button" onClick={() => { setActiveCategory(category.name); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}>
              <span className="category-number">0{index + 1}</span><span>{category.name}</span><span className="category-arrow" aria-hidden="true">↗</span>
            </button><button className="category-share" type="button" onClick={() => copyCategoryLink(category)} aria-label={`Copiar link da categoria ${category.name}`}>{categoryCopiedId === category.id ? shareFallbackLink ? "Copie o link abaixo" : "Link copiado" : "Compartilhar categoria ↗"}</button>{categoryCopiedId === category.id && shareFallbackLink && <input className="share-fallback" aria-label={`Link compartilhável de ${category.name}`} readOnly value={shareFallbackLink} onFocus={(event) => event.currentTarget.select()} />}</div>
          ))}
        </div>
      </section>

      {featuredProducts.length > 0 && featuredProducts.length < filteredProducts.length && <section className="featured-collection" aria-labelledby="featured-title"><div className="catalog-heading"><div><p className="eyebrow">Escolhidos para você</p><h2 id="featured-title">Destaques da <em>vitrine.</em></h2></div><a className="text-button" href="#catalogo">Ver todos os produtos ↗</a></div><div className="product-grid">{featuredProducts.map((product) => <ProductCard key={`featured-${product.id}`} product={product} onChoose={chooseProduct} />)}</div></section>}

      <section className="catalog" id="catalogo" aria-labelledby="catalog-title">
        <div className="catalog-heading"><div><p className="eyebrow">Escolha seu próximo bordado</p><h2 id="catalog-title">Nossa vitrine</h2></div><span className="catalog-count">{filteredProducts.length} {filteredProducts.length === 1 ? "peça" : "peças"}</span></div>

        <div className="catalog-controls">
          <label className="search-control"><span>Buscar produto</span><span className="search-input-wrap"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome do produto..." /></span></label>
          <fieldset className="category-filter"><legend>Categorias</legend><div className="filter-pills"><button type="button" className={activeCategory === "Todos os produtos" ? "selected" : ""} onClick={() => setActiveCategory("Todos os produtos")}>Todos</button>{storeCategories.map((category) => <span className="category-filter-item" key={category.id}><button type="button" className={activeCategory === category.name ? "selected" : ""} onClick={() => setActiveCategory(category.name)}>{category.parentId ? `${storeCategories.find((parent) => parent.id === category.parentId)?.name} · ` : ""}{category.name}</button><button type="button" className="category-filter-share" aria-label={`Copiar link de ${category.parentId ? "subcategoria" : "categoria"} ${category.name}`} onClick={() => copyCategoryLink(category)}>↗</button></span>)}</div>{categoryCopiedId && shareFallbackLink && <input className="share-fallback" aria-label="Link da categoria selecionada" readOnly value={shareFallbackLink} onFocus={(event) => event.currentTarget.select()} />}</fieldset>
          <fieldset className="price-filter"><legend>Preço (R$)</legend><div className="price-inputs"><label><span className="sr-only">Preço mínimo</span><input inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Mín." /></label><span>até</span><label><span className="sr-only">Preço máximo</span><input inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Máx." /></label></div></fieldset>
        </div>

        {filteredProducts.length > 0 ? <div className="product-grid">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onChoose={chooseProduct} />)}</div> : <div className="catalog-empty"><span className="empty-flower" aria-hidden="true">✳</span><h3>Nenhuma peça encontrada</h3><p>Tente outro nome ou escolha uma categoria diferente.</p><button className="text-button reset-button" type="button" onClick={resetFilters}>Limpar filtros</button></div>}
        <p className="catalog-image-note">Fotos de referência dos produtos. Confirme opções, disponibilidade e prazo pelo WhatsApp antes de concluir o pedido.</p>
      </section>

      <section className="how-to-order" aria-labelledby="how-title">
        <p className="eyebrow">✨ Passo a passo</p><h2 id="how-title">Como comprar</h2><p className="how-intro">Em poucos passos, sua peça personalizada começa a ganhar forma.</p>
        <div className="steps-grid"><article><span>01</span><h3>Escolha sua peça</h3><p>Encontre o bordado que combina com você.</p></article><article><span>02</span><h3>Personalize os detalhes</h3><p>Selecione tamanho, cor e quantidade disponíveis.</p></article><article><span>03</span><h3>Converse com a gente</h3><p>Revise seu pedido antes de enviar pelo WhatsApp.</p></article><article><span>04</span><h3>Receba com carinho</h3><p>Combine entrega ou retirada diretamente com a loja.</p></article></div>
      </section>

      <section className="story" id="sobre" aria-labelledby="story-title">
        <Image className="story-logo" src="/brand/logo.jpg" alt="Marca ilustrada do Ateliê Jujubordados" width={176} height={176} />
        <div className="story-copy"><p className="eyebrow">Ateliê de bordados personalizados</p><h2 id="story-title">Cada bordado<br /><em>conta uma história.</em></h2><p>{storeProfile.tagline} Transformamos peças especiais em lembranças únicas, feitas com delicadeza, capricho e amor em cada detalhe.</p></div>
        <span className="story-ornament" aria-hidden="true">✿</span>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#inicio"><Image className="brand-logo" src="/brand/logo.jpg" alt="" width={34} height={34} /><span className="brand-name">jujubordados<span className="brand-period">.</span></span></a>
        <div className="social-links"><a href={storeProfile.instagram} target="_blank" rel="noreferrer">Instagram ↗</a><a href={storeProfile.tiktok} target="_blank" rel="noreferrer">TikTok ↗</a></div>
        <a className="back-top" href="#inicio">Voltar ao início ↑</a>
        <p className="footer-copy">© 2026 JUJUBORDADOS</p>
      </footer>

      <dialog className="product-dialog" ref={productDialog} aria-labelledby="product-dialog-title" onClose={() => setSelectedProduct(null)} onClick={(event) => { if (event.target === productDialog.current) productDialog.current?.close(); }}>
        {selectedProduct && <div className="product-detail">
          <button className="dialog-close" type="button" onClick={() => productDialog.current?.close()} aria-label="Fechar detalhes">×</button>
          <div className="product-detail-gallery"><div className="product-detail-image"><Image src={selectedProductImages[selectedImageIndex] ?? selectedProduct.image} alt={selectedProduct.images?.length ? selectedProduct.name : `Ilustração temporária de ${selectedProduct.name}`} fill sizes="(max-width: 800px) 90vw, 48vw" unoptimized={(selectedProductImages[selectedImageIndex] ?? selectedProduct.image).startsWith("data:")} />{!selectedProduct.images?.length && <span className="illustration-label">Ilustração temporária</span>}</div>{selectedProductImages.length > 1 && <div className="product-gallery-thumbnails" aria-label={`Fotos de ${selectedProduct.name}`}>{selectedProductImages.map((image, index) => <button key={`${selectedProduct.id}-image-${index}`} type="button" className={selectedImageIndex === index ? "selected" : ""} aria-label={`Ver foto ${index + 1} de ${selectedProduct.name}`} aria-pressed={selectedImageIndex === index} onClick={() => setSelectedImageIndex(index)}><Image src={image} alt="" fill sizes="64px" unoptimized={image.startsWith("data:")} /></button>)}</div>}</div>
          <div className="product-detail-copy">
            <p className="product-category">{selectedProduct.category}</p><h2 id="product-dialog-title">{selectedProduct.name}</h2>
            <p className="product-detail-price">{selectedProduct.priceLabel ? `${selectedProduct.priceLabel} ` : ""}{formatPrice(selectedPriceCents)}</p>
            <p className="availability-note">{selectedProduct.availabilityNeedsReview ? "A vitrine atual informa “Pronta entrega”, mas também cita 7 dias úteis de produção. O prazo precisa ser confirmado com a loja." : `${selectedProduct.availability}${selectedProduct.productionDays ? ` · prazo informado de ${selectedProduct.productionDays} dias úteis` : ""}`}</p>
            <div className="product-description">{selectedProduct.description.split("\n").map((paragraph, index) => <p key={`${selectedProduct.id}-description-${index}`}>{paragraph || " "}</p>)}</div>
            <fieldset className="choice-group"><legend>Escolha o tamanho</legend><div className="option-list">{selectedProduct.sizes.map((option) => <button type="button" key={option.label} className={selectedSize === option.label ? "chosen" : ""} onClick={() => setSelectedSize(option.label)}>{option.label} <span>{formatPrice(option.priceCents)}</span></button>)}</div></fieldset>
            {selectedProduct.colors.length > 0 && <fieldset className="choice-group"><legend>Escolha a cor</legend><div className="option-list">{selectedProduct.colors.map((color) => <button type="button" key={color} className={selectedColor === color ? "chosen" : ""} onClick={() => setSelectedColor(color)}>{color}</button>)}</div></fieldset>}
            <div className="detail-bottom"><div className="quantity-control"><span>Quantidade</span><div><button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Diminuir quantidade">−</button><output>{quantity}</output><button type="button" onClick={() => setQuantity((current) => Math.min(20, current + 1))} aria-label="Aumentar quantidade">+</button></div></div><strong>Total do item {formatPrice(selectedPriceCents * quantity)}</strong></div>
            <div className="detail-actions"><button className="button button-rose" type="button" onClick={addToCart}>Adicionar à sacola <span aria-hidden="true">＋</span></button><button className="share-button" type="button" onClick={copyProductLink}>{copied ? "Link copiado" : "Copiar link do produto"}</button></div>{shareFallbackLink && <input className="share-fallback" aria-label="Link compartilhável do produto" readOnly value={shareFallbackLink} onFocus={(event) => event.currentTarget.select()} />}
          </div>
        </div>}
      </dialog>

      <dialog className="cart-dialog" ref={cartDialog} aria-labelledby="cart-title" onClick={(event) => { if (event.target === cartDialog.current) cartDialog.current?.close(); }}>
        <div className="cart-panel"><button className="dialog-close" type="button" onClick={() => cartDialog.current?.close()} aria-label="Fechar sacola">×</button>
          <p className="eyebrow">Seu pedido</p><h2 id="cart-title">Sacola <span>({totalItems})</span></h2>
          {orderConfirmation && <p className="coupon-success" role="status">{orderConfirmation}</p>}
          {cart.length === 0 ? <div className="cart-empty"><span aria-hidden="true">✳</span><p>Sua sacola ainda está vazia.</p><button className="text-button" type="button" onClick={() => cartDialog.current?.close()}>Continuar escolhendo</button></div> : <>
          <ul className="cart-list">{cart.map((line) => <li className="cart-line" key={line.key}><div className="cart-thumb"><Image src={line.image} alt="" fill sizes="72px" unoptimized={line.image.startsWith("data:")} /></div><div className="cart-line-info"><h3>{line.name}</h3><p>{line.size}{line.color ? ` · ${line.color}` : ""}</p><strong>{formatPrice(line.unitPriceCents * line.quantity)}</strong><div className="cart-line-quantity"><button type="button" onClick={() => updateQuantity(line.key, -1)} aria-label={`Diminuir ${line.name}`}>−</button><span>{line.quantity}</span><button type="button" onClick={() => updateQuantity(line.key, 1)} aria-label={`Aumentar ${line.name}`}>+</button><button className="remove-line" type="button" onClick={() => updateCart((current) => current.filter((item) => item.key !== line.key))}>Remover</button></div></div></li>)}</ul>
            <form className="coupon-entry" onSubmit={(event) => { event.preventDefault(); applyCoupon(); }}><label htmlFor="cart-coupon">Cupom de desconto</label><div><input id="cart-coupon" autoComplete="off" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="Digite seu cupom" /><button type="submit">Aplicar</button></div>{couponMessage && <p className={appliedCoupon ? "coupon-success" : "coupon-feedback"} role="status">{couponMessage}</p>}{appliedCoupon && <button className="coupon-remove" type="button" onClick={removeCoupon}>Remover cupom</button>}</form>
            <form className="checkout-form" onSubmit={submitCheckout}>
              <fieldset className="checkout-delivery"><legend>Como deseja receber?</legend><div className="delivery-mode-options"><label><input type="radio" name="delivery-mode" checked={deliveryMode === "delivery"} onChange={() => setDeliveryMode("delivery")} /> Entrega</label><label><input type="radio" name="delivery-mode" checked={deliveryMode === "pickup"} onChange={() => setDeliveryMode("pickup")} /> Retirada</label></div>
                {deliveryMode === "delivery" && <div className="delivery-address-fields"><label>Endereço<input required autoComplete="street-address" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} placeholder="Rua e número" /></label><label>Cidade<input required autoComplete="address-level2" value={customerCity} onChange={(event) => setCustomerCity(event.target.value)} /></label><label>UF<input required autoComplete="address-level1" maxLength={2} minLength={2} pattern="[A-Za-z]{2}" title="Informe a sigla de dois caracteres do estado." value={customerState} onChange={(event) => setCustomerState(event.target.value.toLocaleUpperCase("pt-BR"))} /></label><label>CEP (opcional)<input inputMode="numeric" autoComplete="postal-code" maxLength={9} pattern="[0-9]{5}-?[0-9]{3}" title="Use 00000-000 ou 00000000." value={customerCep} onChange={(event) => setCustomerCep(event.target.value)} placeholder="00000-000" /></label></div>}
              </fieldset>
              <div className="checkout-customer-fields"><label>Seu nome<input required autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label>WhatsApp para contato<input required type="tel" inputMode="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label></div>
              <div className="cart-total"><span>Subtotal dos itens</span><strong>{formatPrice(totalPriceCents)}</strong></div>{couponDiscountCents > 0 && <div className="cart-discount"><span>Desconto · {appliedCoupon?.code}</span><strong>−{formatPrice(couponDiscountCents)}</strong></div>}{deliveryMode === "delivery" && matchedShippingRule && <div className="cart-total"><span>Frete · {matchedShippingRule.label}</span><strong>{formatPrice(matchedShippingRule.priceCents)}</strong></div>}<div className="cart-total cart-grand-total"><span>{deliveryMode === "delivery" && !matchedShippingRule ? "Total dos itens · frete a confirmar" : "Total estimado"}</span><strong>{formatPrice(checkoutTotalCents + (shippingCents ?? 0))}</strong></div><p className="cart-shipping-note">{deliveryMode === "pickup" ? "Retirada sem custo de frete; horário será combinado com a loja." : matchedShippingRule ? "Frete calculado pela regra cadastrada; confirme disponibilidade com a loja." : "Não encontramos regra para esta região. O frete será confirmado com a loja no WhatsApp."}</p>
              {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}
              <p className="cart-shipping-note">Seus dados serão usados para registrar e combinar este pedido com a loja.</p>
              <button className="button button-rose checkout-button" type="submit">{storeProfile.whatsappNumber ? "Registrar e enviar ao WhatsApp" : "Registrar pedido"} <span aria-hidden="true">↗</span></button>
            </form>
          </>}
        </div>
      </dialog>
    </main>
  );
}
