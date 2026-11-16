"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatPrice, products as initialProducts, type StoreProduct } from "@/data/catalog";
import { getCatalogSnapshot, getCategorySnapshot, getServerCatalogSnapshot, getServerCategorySnapshot, parseCategories, saveCatalog, saveCategories, subscribeToCatalog, subscribeToCategories } from "@/data/store-catalog";
import { getOperationsSnapshot, getServerOperationsSnapshot, parseOperations, saveOperations, subscribeToOperations, type CalendarCategory, type FinanceEntry, type LocalCoupon, type LocalCustomer, type LocalOrder, type LocalQuote, type LocalQuoteItem, type LocalShippingRule, type OrderStatus, type QuoteStatus } from "@/data/store-operations";
import PwaInstall from "../pwa-install";
import ShareQr from "../share-qr";
import StoreMetrics from "./metrics";
import CalendarSuggestions from "./calendar-suggestions";

type PanelSection = "overview" | "catalog" | "categories" | "orders" | "customers" | "quotes" | "coupons" | "shipping" | "metrics" | "calendar" | "finance";
type QuoteItemDraft = { description: string; quantity: string; unitPrice: string };

function quoteLineItems(quote: LocalQuote): LocalQuoteItem[] {
  return quote.items?.length ? quote.items : [{ description: quote.itemDescription, quantity: quote.quantity, unitPriceCents: quote.unitPriceCents }];
}

function quoteTotalCents(quote: LocalQuote) {
  return quoteLineItems(quote).reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

const panelSections: PanelSection[] = ["overview", "catalog", "categories", "orders", "customers", "quotes", "coupons", "shipping", "metrics", "calendar", "finance"];

async function compressProductPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: selecione um arquivo de imagem.`);
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name}: o arquivo deve ter até 12 MB.`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Não foi possível preparar a foto neste navegador."); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
  if (!blob) throw new Error(`${file.name}: não foi possível processar a foto.`);
  if (blob.size > 400 * 1024) throw new Error(`${file.name}: após otimização, a foto ainda excede 400 KB. Use uma imagem menor.`);
  return blob;
}

function getSectionSnapshot(): PanelSection {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.slice(1);
  return panelSections.includes(hash as PanelSection) ? hash as PanelSection : "overview";
}

function getServerSectionSnapshot(): PanelSection { return "overview"; }

function getLocalDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function subscribeToSection(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export default function AdminPanel() {
  const isProduction = process.env.NODE_ENV === "production";
  const catalogJson = useSyncExternalStore(subscribeToCatalog, getCatalogSnapshot, getServerCatalogSnapshot);
  const catalog = useMemo<StoreProduct[]>(() => {
    try {
      const parsed: unknown = JSON.parse(catalogJson);
      return Array.isArray(parsed) ? parsed as StoreProduct[] : initialProducts;
    } catch {
      return initialProducts;
    }
  }, [catalogJson]);
  const [query, setQuery] = useState("");
  const categoriesJson = useSyncExternalStore(subscribeToCategories, getCategorySnapshot, getServerCategorySnapshot);
  const categories = useMemo(() => parseCategories(categoriesJson), [categoriesJson]);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryParent, setSubcategoryParent] = useState("");
  const [notice, setNotice] = useState("");
  const section = useSyncExternalStore(subscribeToSection, getSectionSnapshot, getServerSectionSnapshot);
  const operationsJson = useSyncExternalStore(subscribeToOperations, getOperationsSnapshot, getServerOperationsSnapshot);
  const operations = useMemo(() => parseOperations(operationsJson), [operationsJson]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderName, setOrderName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderDescription, setOrderDescription] = useState("");
  const [orderTotal, setOrderTotal] = useState("");
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [customerBirthday, setCustomerBirthday] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState("");
  const [financeKind, setFinanceKind] = useState<"income" | "expense">("income");
  const [financeCategory, setFinanceCategory] = useState("Vendas");
  const [financeDescription, setFinanceDescription] = useState("");
  const [financeAmount, setFinanceAmount] = useState("");
  const [financeDate, setFinanceDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [quoteName, setQuoteName] = useState("");
  const [quotePhone, setQuotePhone] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItemDraft[]>([{ description: "", quantity: "1", unitPrice: "" }]);
  const [editingQuoteId, setEditingQuoteId] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quoteDeliveryDate, setQuoteDeliveryDate] = useState("");
  const [quoteDeposit, setQuoteDeposit] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [printingQuoteId, setPrintingQuoteId] = useState("");
  const [confirmQuoteDeleteId, setConfirmQuoteDeleteId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percentage" | "fixed">("percentage");
  const [couponAmount, setCouponAmount] = useState("");
  const [confirmCouponDeleteId, setConfirmCouponDeleteId] = useState("");
  const [shippingLabel, setShippingLabel] = useState("");
  const [shippingMatchType, setShippingMatchType] = useState<LocalShippingRule["matchType"]>("cep");
  const [shippingMatchValue, setShippingMatchValue] = useState("");
  const [shippingPrice, setShippingPrice] = useState("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarCategory, setCalendarCategory] = useState<CalendarCategory>("Data importante");
  const [calendarNotes, setCalendarNotes] = useState("");
  const [today, setToday] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setToday(getLocalDateInputValue()), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    let mounted = true;
    let hydrating = true;
    let ready = false;
    let operationsTimer = 0;
    let catalogTimer = 0;
    let pollTimer = 0;
    let lastSyncedOperations = "";
    let lastSyncedCatalog = "";
    let lastSyncedCategories = "";

    const syncOperations = () => {
      if (!ready || hydrating) return;
      window.clearTimeout(operationsTimer);
      operationsTimer = window.setTimeout(() => {
        const currentOperations = parseOperations(getOperationsSnapshot());
        void fetch("/api/admin/operations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operations: currentOperations }) }).then((response) => {
          if (!response.ok && mounted) setNotice("Falha ao salvar os dados operacionais compartilhados.");
          else if (response.ok) lastSyncedOperations = getOperationsSnapshot();
        }).catch(() => { if (mounted) setNotice("Falha ao conectar ao banco. As alterações estão apenas neste navegador."); });
      }, 350);
    };
    const syncCatalog = () => {
      if (!ready || hydrating) return;
      window.clearTimeout(catalogTimer);
      catalogTimer = window.setTimeout(() => {
        const productSnapshot = getCatalogSnapshot();
        const categorySnapshot = getCategorySnapshot();
        void fetch("/api/admin/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: JSON.parse(productSnapshot), categories: parseCategories(categorySnapshot) }) }).then((response) => {
          if (!response.ok && mounted) setNotice("Falha ao salvar o catálogo compartilhado.");
          else if (response.ok) { lastSyncedCatalog = getCatalogSnapshot(); lastSyncedCategories = getCategorySnapshot(); }
        }).catch(() => { if (mounted) setNotice("Falha ao conectar ao banco. As alterações estão apenas neste navegador."); });
      }, 350);
    };
    const stopOperations = subscribeToOperations(syncOperations);
    const stopCatalog = subscribeToCatalog(syncCatalog);
    const stopCategories = subscribeToCategories(syncCatalog);

    void Promise.all([fetch("/api/admin/operations", { cache: "no-store" }), fetch("/api/store/catalog", { cache: "no-store" })]).then(async ([operationsResponse, catalogResponse]) => {
      if (!operationsResponse.ok || !catalogResponse.ok) throw new Error("sync_unavailable");
      const [operationData, catalogData] = await Promise.all([operationsResponse.json(), catalogResponse.json()]) as [{ operations: unknown }, { products: unknown; categories: unknown }];
      if (!mounted || !Array.isArray(catalogData.products) || !Array.isArray(catalogData.categories)) return;
      hydrating = true;
      saveOperations(parseOperations(JSON.stringify(operationData.operations)));
      saveCatalog(catalogData.products as StoreProduct[]);
      saveCategories(catalogData.categories as ReturnType<typeof parseCategories>);
      hydrating = false;
      ready = true;
      lastSyncedOperations = getOperationsSnapshot();
      lastSyncedCatalog = getCatalogSnapshot();
      lastSyncedCategories = getCategorySnapshot();
      if (mounted) setNotice("Dados sincronizados com a loja.");
    }).catch(() => { if (mounted) setNotice("Não foi possível sincronizar. Confira sua conexão e sessão."); });

    const pollSharedData = async () => {
      if (!ready || document.visibilityState !== "visible") return;
      try {
        const [operationsResponse, catalogResponse] = await Promise.all([fetch("/api/admin/operations", { cache: "no-store" }), fetch("/api/store/catalog", { cache: "no-store" })]);
        if (!operationsResponse.ok || !catalogResponse.ok) return;
        const [operationData, catalogData] = await Promise.all([operationsResponse.json(), catalogResponse.json()]) as [{ operations: unknown }, { products: unknown; categories: unknown }];
        if (!Array.isArray(catalogData.products) || !Array.isArray(catalogData.categories)) return;
        hydrating = true;
        if (getOperationsSnapshot() === lastSyncedOperations) { saveOperations(parseOperations(JSON.stringify(operationData.operations))); lastSyncedOperations = getOperationsSnapshot(); }
        if (getCatalogSnapshot() === lastSyncedCatalog) { saveCatalog(catalogData.products as StoreProduct[]); lastSyncedCatalog = getCatalogSnapshot(); }
        if (getCategorySnapshot() === lastSyncedCategories) { saveCategories(catalogData.categories as ReturnType<typeof parseCategories>); lastSyncedCategories = getCategorySnapshot(); }
      } catch { /* Keep the last known good local snapshot when the connection drops. */ }
      finally { hydrating = false; }
    };
    pollTimer = window.setInterval(() => { void pollSharedData(); }, 30_000);
    document.addEventListener("visibilitychange", pollSharedData);
    return () => {
      mounted = false;
      stopOperations(); stopCatalog(); stopCategories();
      document.removeEventListener("visibilitychange", pollSharedData);
      window.clearTimeout(operationsTimer); window.clearTimeout(catalogTimer); window.clearInterval(pollTimer);
    };
  }, []);
  const filtered = catalog.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()));
  const currentMonthKey = today.slice(0, 7);
  const receivedThisMonth = operations.financeEntries.filter((entry) => entry.kind === "income" && entry.date.startsWith(currentMonthKey)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const outstandingOrders = operations.orders.filter((order) => order.status !== "Cancelado").map((order) => ({ order, balance: Math.max(0, order.totalCents - (order.payments ?? []).reduce((sum, payment) => sum + payment.amountCents, 0)) })).filter(({ balance }) => balance > 0);
  const outstandingCents = outstandingOrders.reduce((sum, item) => sum + item.balance, 0);
  const overdueOrdersCount = outstandingOrders.filter(({ order }) => order.dueDate && order.dueDate < today).length;

  function openFinance() {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString();
    setFinanceDate(localToday.slice(0, 10));
    setCurrentMonth(localToday.slice(0, 7));
    window.location.hash = "finance";
  }

  function updateProduct(id: string, update: Partial<StoreProduct>) {
    saveCatalog(catalog.map((product) => product.id === id ? { ...product, ...update } : product));
    setNotice("Alteração salva. Sincronizando com a loja...");
    window.setTimeout(() => setNotice(""), 2600);
  }

  function updateProductOptionPrice(product: StoreProduct, optionIndex: number, input: HTMLInputElement) {
    const nextValue = Number(input.value);
    if (!input.value || !Number.isFinite(nextValue) || nextValue < 0) {
      input.value = ((product.sizes[optionIndex]?.priceCents ?? 0) / 100).toFixed(2);
      return;
    }
    const sizes = product.sizes.map((option, index) => index === optionIndex ? { ...option, priceCents: Math.round(nextValue * 100) } : option);
    updateProduct(product.id, { sizes, priceCents: Math.min(...sizes.map((option) => option.priceCents)) });
  }

  async function addProductPhotos(id: string, event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    const product = catalog.find((item) => item.id === id);
    if (!product) return;
    const current = product.images ?? [];
    const accepted = files.slice(0, Math.max(0, 5 - current.length));
    if (!accepted.length) { setNotice("Cada produto aceita até 5 fotos. Remova uma antes de adicionar outra."); return; }
    try {
      const compressed = await Promise.all(accepted.map(compressProductPhoto));
      const added = await Promise.all(compressed.map(async (blob, index) => {
        const form = new FormData();
        form.set("image", blob, `${accepted[index].name.replace(/\.[^.]+$/, "")}.webp`);
        const response = await fetch("/api/admin/assets", { method: "POST", body: form });
        if (!response.ok) throw new Error(`${accepted[index].name}: falha ao enviar a foto para o armazenamento da loja.`);
        const result = await response.json() as { src?: string };
        if (!result.src) throw new Error(`${accepted[index].name}: endereço de imagem inválido.`);
        return result.src;
      }));
      const images = [...current, ...added];
      const nextCatalog = catalog.map((item) => item.id === id ? { ...item, image: images[0], images } : item);
      const persisted = saveCatalog(nextCatalog);
      setNotice(persisted ? files.length > accepted.length ? `Adicionadas ${added.length} fotos. O limite é 5 por produto.` : `${added.length} fotos otimizadas. Sincronizando o catálogo com a loja.` : "Fotos exibidas nesta sessão, mas o navegador não conseguiu salvá-las. Libere espaço no armazenamento local e tente novamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível adicionar as fotos.");
    }
    window.setTimeout(() => setNotice(""), 5500);
  }

  function removeProductPhoto(id: string, index: number) {
    const product = catalog.find((item) => item.id === id);
    if (!product) return;
    const images = (product.images ?? []).filter((_, photoIndex) => photoIndex !== index);
    const fallbackImage = initialProducts.find((item) => item.id === id)?.image ?? product.image;
    saveCatalog(catalog.map((item) => item.id === id ? { ...item, images: images.length ? images : undefined, image: images[0] ?? fallbackImage } : item));
    setNotice("Foto removida. Sincronizando o catálogo..."); window.setTimeout(() => setNotice(""), 3000);
  }

  function resetCatalog() {
    saveCatalog(initialProducts);
    saveCategories(parseCategories(getServerCategorySnapshot()));
    setNotice("Catálogo atual restaurado. Sincronizando...");
    window.setTimeout(() => setNotice(""), 2600);
  }

  function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name || name.length > 48) { setNotice("O nome da categoria deve ter de 1 a 48 caracteres."); return; }
    if (categories.some((item) => item.parentId === (subcategoryParent || null) && item.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)) { setNotice("Já existe uma categoria com esse nome neste nível."); return; }
    const id = `CAT-${Date.now().toString(36)}`;
    saveCategories([...categories, { id, name, parentId: subcategoryParent || null }]);
    setCategoryName(""); setNotice(`${subcategoryParent ? "Subcategoria" : "Categoria"} criada.`); window.setTimeout(() => setNotice(""), 3000);
  }

  function renameCategory(id: string, name: string) {
    const previous = categories.find((category) => category.id === id);
    if (!previous || !name.trim() || name.length > 48 || categories.some((category) => category.id !== id && category.parentId === previous.parentId && category.name.localeCompare(name.trim(), "pt-BR", { sensitivity: "base" }) === 0)) return;
    const trimmed = name.trim();
    saveCategories(categories.map((category) => category.id === id ? { ...category, name: trimmed } : category));
    if (!previous.parentId) saveCatalog(catalog.map((product) => product.category === previous.name ? { ...product, category: trimmed } : product));
    else {
      const parentName = categories.find((category) => category.id === previous.parentId)?.name;
      saveCatalog(catalog.map((product) => product.category === parentName && product.subcategory === previous.name ? { ...product, subcategory: trimmed } : product));
    }
  }

  function deleteCategory(id: string) {
    const target = categories.find((category) => category.id === id);
    if (!target) return;
    const removedIds = target.parentId ? new Set([id]) : new Set([id, ...categories.filter((category) => category.parentId === id).map((category) => category.id)]);
    const children = categories.filter((category) => category.parentId === target.id);
    saveCategories(categories.filter((category) => !removedIds.has(category.id)));
    saveCatalog(catalog.map((product) => target.parentId ? product.category === categories.find((category) => category.id === target.parentId)?.name && product.subcategory === target.name ? { ...product, subcategory: undefined } : product : product.category === target.name ? { ...product, category: "Sem categoria", subcategory: undefined } : children.some((child) => product.category === target.name && product.subcategory === child.name) ? { ...product, category: "Sem categoria", subcategory: undefined } : product));
    setNotice("Categoria removida. Os produtos foram preservados e os que pertenciam a ela estão sem categoria."); window.setTimeout(() => setNotice(""), 3500);
  }

  function updateProductCategory(id: string, categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : category;
    if (!parent) return;
    const subcategory = category.parentId ? category.name : undefined;
    saveCatalog(catalog.map((product) => product.id === id ? { ...product, category: parent.name, subcategory } : product));
  }

  function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dueDate = String(new FormData(event.currentTarget).get("dueDate") ?? "");
    const amountCents = Math.round(Number(orderTotal.replace(",", ".")) * 100);
    if (!orderName.trim() || !orderDescription.trim() || !Number.isFinite(amountCents) || amountCents <= 0) return;
    const customerId = operations.customers.find((customer) => customer.phone.replace(/\D/g, "") === orderPhone.replace(/\D/g, "") && orderPhone.trim())?.id;
    const order: LocalOrder = { id: `PED-${Date.now().toString().slice(-6)}`, customerName: orderName.trim(), customerPhone: orderPhone.trim(), description: orderDescription.trim(), totalCents: amountCents, status: "Novo", paymentStatus: "Pendente", createdAt: new Date().toISOString(), dueDate: dueDate || undefined, payments: [] };
    const customers = customerId || !orderPhone.trim() ? operations.customers : [...operations.customers, { id: `CLI-${Date.now().toString().slice(-6)}`, name: orderName.trim(), phone: orderPhone.trim(), email: "", notes: "" }];
    saveOperations({ ...operations, orders: [order, ...operations.orders], customers });
    setShowNewOrder(false); setOrderName(""); setOrderPhone(""); setOrderDescription(""); setOrderTotal("");
    setNotice("Pedido manual registrado. Sincronizando..."); window.setTimeout(() => setNotice(""), 3000);
  }

  function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerName.trim()) return;
    const customer: LocalCustomer = { id: `CLI-${Date.now().toString().slice(-6)}`, name: customerName.trim(), phone: customerPhone.trim(), email: customerEmail.trim(), notes: customerNotes.trim(), birthday: customerBirthday || undefined };
    saveOperations({ ...operations, customers: [customer, ...operations.customers] });
    setCustomerName(""); setCustomerPhone(""); setCustomerEmail(""); setCustomerNotes(""); setCustomerBirthday("");
    setNotice("Cliente salvo. Sincronizando..."); window.setTimeout(() => setNotice(""), 3000);
  }

  function createCalendarEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = calendarTitle.trim();
    if (!title || !calendarDate) { setNotice("Informe o nome e a data do compromisso."); return; }
    const calendarEvent = { id: `EVT-${crypto.randomUUID()}`, title, date: calendarDate, category: calendarCategory, notes: calendarNotes.trim() };
    saveOperations({ ...operations, calendarEvents: [calendarEvent, ...operations.calendarEvents] });
    setCalendarTitle(""); setCalendarDate(""); setCalendarCategory("Data importante"); setCalendarNotes("");
    setNotice("Data salva no calendário da loja."); window.setTimeout(() => setNotice(""), 3000);
  }

  function deleteCalendarEvent(id: string) {
    saveOperations({ ...operations, calendarEvents: operations.calendarEvents.filter((item) => item.id !== id) });
    setNotice("Data removida do calendário."); window.setTimeout(() => setNotice(""), 3000);
  }

  function addSeasonalSuggestion(suggestion: { title: string; date: string }) {
    if (operations.calendarEvents.some((item) => item.title === suggestion.title && item.date === suggestion.date)) return;
    const event = { id: `EVT-${crypto.randomUUID()}`, title: suggestion.title, date: suggestion.date, category: "Campanha" as const, notes: "Sugestão sazonal nacional; confirme se faz sentido para a loja." };
    saveOperations({ ...operations, calendarEvents: [event, ...operations.calendarEvents] });
    setNotice("Sugestão adicionada à agenda. Revise o planejamento e os prazos da loja."); window.setTimeout(() => setNotice(""), 3500);
  }

  function changeOrderStatus(id: string, status: OrderStatus) {
    saveOperations({ ...operations, orders: operations.orders.map((order) => order.id === id ? { ...order, status } : order) });
  }

  function recordOrderPayment(event: React.FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    const order = operations.orders.find((item) => item.id === orderId);
    if (!order || order.status === "Cancelado") { setNotice("Pedidos cancelados não aceitam recebimentos."); return; }
    const amountCents = Math.round(Number((paymentAmounts[orderId] ?? "").replace(",", ".")) * 100);
    const alreadyPaidCents = (order.payments ?? []).reduce((sum, payment) => sum + payment.amountCents, 0);
    const remainingCents = Math.max(0, order.totalCents - alreadyPaidCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setNotice("Informe um valor de recebimento maior que zero."); return; }
    if (amountCents > remainingCents) { setNotice(`O recebimento não pode ultrapassar o saldo de ${formatPrice(remainingCents)}.`); return; }
    const receivedAt = new Date().toISOString();
    const receiptId = receivedAt.replace(/\D/g, "");
    const payment = { id: `PAG-${receiptId}`, amountCents, receivedAt };
    const payments = [...(order.payments ?? []), payment];
    const totalPaid = alreadyPaidCents + amountCents;
    const updatedOrder = { ...order, payments, paymentStatus: totalPaid >= order.totalCents ? "Pago" as const : "Parcial" as const };
    const entry: FinanceEntry = { id: `FIN-${receiptId}`, kind: "income", category: "Vendas", description: `Recebimento do pedido ${order.id}`, amountCents, date: getLocalDateInputValue(), relatedOrderId: order.id };
    saveOperations({ ...operations, orders: operations.orders.map((item) => item.id === orderId ? updatedOrder : item), financeEntries: [entry, ...operations.financeEntries] });
    setPaymentAmounts((current) => ({ ...current, [orderId]: "" }));
    setNotice(`${formatPrice(amountCents)} recebido e adicionado ao financeiro. Saldo do pedido: ${formatPrice(remainingCents - amountCents)}.`);
    window.setTimeout(() => setNotice(""), 4500);
  }

  function resetDemoData() {
    saveOperations({ ...operations, orders: [], customers: [], financeEntries: operations.financeEntries.filter((entry) => !entry.relatedOrderId) });
    setNotice("Pedidos e clientes locais removidos."); window.setTimeout(() => setNotice(""), 3000);
  }

  function addFinanceEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = Math.round(Number(financeAmount.replace(",", ".")) * 100);
    if (!financeDescription.trim() || !Number.isFinite(cents) || cents <= 0 || !financeDate) return;
    const entry: FinanceEntry = { id: `FIN-${Date.now().toString().slice(-6)}`, kind: financeKind, category: financeCategory, description: financeDescription.trim(), amountCents: cents, date: financeDate };
    saveOperations({ ...operations, financeEntries: [entry, ...operations.financeEntries] });
    setFinanceDescription(""); setFinanceAmount("");
    setNotice(financeKind === "income" ? "Recebimento registrado manualmente." : "Despesa registrada manualmente."); window.setTimeout(() => setNotice(""), 3000);
  }

  function saveMonthlyGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = Math.round(Number(goalAmount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    saveOperations({ ...operations, monthlyGoalCents: cents });
    setNotice("Meta mensal salva. Sincronizando..."); window.setTimeout(() => setNotice(""), 3000);
  }

  function createQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = quoteItems.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPriceCents: Math.round(Number(item.unitPrice.replace(",", ".")) * 100) }));
    const totalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const depositPercent = Number(quoteDeposit.replace(",", ".")) || 0;
    if (!quoteName.trim() || !items.length || items.length > 30 || items.some((item) => !item.description || item.description.length > 250 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000 || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 1 || item.unitPriceCents > 100_000_000) || !Number.isSafeInteger(totalCents) || totalCents <= 0 || depositPercent < 0 || depositPercent > 100) {
      setNotice("Confira nome, itens, quantidades e valores. Cada orçamento aceita até 30 itens.");
      return;
    }
    const firstItem = items[0];
    const quote: LocalQuote = { id: editingQuoteId || `ORC-${crypto.randomUUID()}`, customerName: quoteName.trim(), customerPhone: quotePhone.trim(), itemDescription: firstItem.description, quantity: firstItem.quantity, unitPriceCents: firstItem.unitPriceCents, items, validUntil: quoteValidUntil, deliveryDate: quoteDeliveryDate, depositCents: Math.round(totalCents * depositPercent / 100), notes: quoteNotes.trim(), status: editingQuoteId ? operations.quotes.find((item) => item.id === editingQuoteId)?.status ?? "Em aberto" : "Em aberto", createdAt: editingQuoteId ? operations.quotes.find((item) => item.id === editingQuoteId)?.createdAt ?? new Date().toISOString() : new Date().toISOString() };
    const customerExists = quotePhone.trim() && operations.customers.some((customer) => customer.phone.replace(/\D/g, "") === quotePhone.replace(/\D/g, ""));
    const customer = editingQuoteId || customerExists || !quotePhone.trim() ? [] : [{ id: `CLI-${crypto.randomUUID()}`, name: quoteName.trim(), phone: quotePhone.trim(), email: "", notes: "" }];
    saveOperations({ ...operations, quotes: editingQuoteId ? operations.quotes.map((item) => item.id === editingQuoteId ? quote : item) : [quote, ...operations.quotes], customers: [...customer, ...operations.customers] });
    resetQuoteDraft();
    setNotice(editingQuoteId ? "Orçamento atualizado." : "Orçamento salvo."); window.setTimeout(() => setNotice(""), 3000);
  }

  function resetQuoteDraft() {
    setEditingQuoteId(""); setQuoteName(""); setQuotePhone(""); setQuoteItems([{ description: "", quantity: "1", unitPrice: "" }]); setQuoteValidUntil(""); setQuoteDeliveryDate(""); setQuoteDeposit(""); setQuoteNotes("");
  }

  function editQuote(quote: LocalQuote) {
    if (quote.status !== "Em aberto") return;
    setEditingQuoteId(quote.id);
    setQuoteName(quote.customerName);
    setQuotePhone(quote.customerPhone);
    setQuoteItems(quoteLineItems(quote).map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: (item.unitPriceCents / 100).toFixed(2).replace(".", ",") })));
    setQuoteValidUntil(quote.validUntil);
    setQuoteDeliveryDate(quote.deliveryDate);
    setQuoteDeposit(quoteTotalCents(quote) ? String(Math.round(quote.depositCents / quoteTotalCents(quote) * 10000) / 100).replace(".", ",") : "");
    setQuoteNotes(quote.notes);
    document.getElementById("quotes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateQuoteStatus(event: React.ChangeEvent<HTMLSelectElement>) {
    const quote = operations.quotes.find((item) => item.id === event.currentTarget.dataset.quoteId);
    const status = event.currentTarget.value as QuoteStatus;
    if (!quote) return;
    if (status === "Convertido em pedido" && quote.status !== "Convertido em pedido") {
      const items = quoteLineItems(quote);
      const order: LocalOrder = { id: `PED-${crypto.randomUUID()}`, customerName: quote.customerName, customerPhone: quote.customerPhone, description: items.map((item) => `${item.quantity}x ${item.description} · ${formatPrice(item.unitPriceCents)} cada · ${formatPrice(item.quantity * item.unitPriceCents)}`).join("\n"), totalCents: quoteTotalCents(quote), status: "Novo", paymentStatus: "Pendente", createdAt: new Date().toISOString() };
      saveOperations({ ...operations, orders: [order, ...operations.orders], quotes: operations.quotes.map((item) => item.id === quote.id ? { ...item, status } : item) });
    } else saveOperations({ ...operations, quotes: operations.quotes.map((item) => item.id === quote.id ? { ...item, status } : item) });
    setNotice(status === "Convertido em pedido" ? "Orçamento convertido em pedido." : "Status do orçamento atualizado."); window.setTimeout(() => setNotice(""), 3000);
  }

  function printQuote(id: string) {
    setPrintingQuoteId(id);
    window.setTimeout(() => { window.print(); window.setTimeout(() => setPrintingQuoteId(""), 500); }, 100);
  }

  function sendQuoteToWhatsApp(quote: LocalQuote) {
    const items = quoteLineItems(quote);
    const total = quoteTotalCents(quote);
    const message = [
      `Olá, ${quote.customerName}! Segue o orçamento da Jujubordados:`,
      ...items.map((item) => `${item.quantity}x ${item.description} - ${formatPrice(item.unitPriceCents)} cada (${formatPrice(item.quantity * item.unitPriceCents)})`),
      `Total: ${formatPrice(total)}`,
      quote.depositCents > 0 ? `Sinal: ${formatPrice(quote.depositCents)} · Saldo: ${formatPrice(Math.max(0, total - quote.depositCents))}` : "",
      quote.validUntil ? `Válido até: ${new Date(`${quote.validUntil}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : "",
      quote.deliveryDate ? `Entrega prevista: ${new Date(`${quote.deliveryDate}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : "",
      quote.notes ? `Observações: ${quote.notes}` : "",
    ].filter(Boolean).join("\n");
    const phone = quote.customerPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function deleteQuote(id: string) {
    setConfirmQuoteDeleteId(id);
  }

  function confirmDeleteQuote(id: string) {
    saveOperations({ ...operations, quotes: operations.quotes.filter((quote) => quote.id !== id) });
    setConfirmQuoteDeleteId("");
    setNotice("Orçamento removido."); window.setTimeout(() => setNotice(""), 3000);
  }

  function createCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = couponCode.trim().replace(/\s+/g, "").toLocaleUpperCase("pt-BR");
    const value = Number(couponAmount.replace(",", "."));
    if (!/^[A-Z0-9-]{2,24}$/.test(code)) { setNotice("Use de 2 a 24 letras, números ou hífens no código."); return; }
    if (operations.coupons.some((coupon) => coupon.code === code)) { setNotice("Já existe um cupom com esse código."); return; }
    if (!Number.isFinite(value) || value <= 0 || (couponType === "percentage" && value > 100)) { setNotice(couponType === "percentage" ? "Informe um percentual entre 0 e 100." : "Informe um valor de desconto maior que zero."); return; }
    const coupon: LocalCoupon = { id: `CUP-${Date.now().toString().slice(-6)}`, code, discountType: couponType, amount: couponType === "fixed" ? Math.round(value * 100) : Math.round(value * 100) / 100, active: true };
    saveOperations({ ...operations, coupons: [coupon, ...operations.coupons] });
    setCouponCode(""); setCouponAmount("");
    setNotice(`Cupom ${code} criado. Sincronizando com a vitrine...`); window.setTimeout(() => setNotice(""), 3000);
  }

  function toggleCoupon(id: string) {
    saveOperations({ ...operations, coupons: operations.coupons.map((coupon) => coupon.id === id ? { ...coupon, active: !coupon.active } : coupon) });
  }

  function confirmDeleteCoupon(id: string) {
    saveOperations({ ...operations, coupons: operations.coupons.filter((coupon) => coupon.id !== id) });
    setConfirmCouponDeleteId("");
    setNotice("Cupom removido."); window.setTimeout(() => setNotice(""), 3000);
  }

  function createShippingRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matchValue = shippingMatchValue.trim();
    const priceCents = Math.round(Number(shippingPrice.replace(",", ".")) * 100);
    if (!shippingLabel.trim() || !matchValue || !Number.isFinite(priceCents) || priceCents < 0) {
      setNotice("Informe nome, região e um valor de frete válido.");
      return;
    }
    if (shippingMatchType === "cep" && !/^\d{5}(-?\d{3})?$/.test(matchValue)) {
      setNotice("Para CEP, use um CEP de 8 dígitos ou um prefixo com 5 dígitos.");
      return;
    }
    const rule: LocalShippingRule = { id: `FRE-${Date.now().toString().slice(-6)}`, label: shippingLabel.trim(), matchType: shippingMatchType, matchValue: shippingMatchType === "state" ? matchValue.toLocaleUpperCase("pt-BR") : matchValue, priceCents, active: true };
    saveOperations({ ...operations, shippingRules: [rule, ...operations.shippingRules] });
    setShippingLabel(""); setShippingMatchValue(""); setShippingPrice("");
    setNotice("Regra de entrega salva. Sincronizando..."); window.setTimeout(() => setNotice(""), 3000);
  }

  function toggleShippingRule(id: string) {
    saveOperations({ ...operations, shippingRules: operations.shippingRules.map((rule) => rule.id === id ? { ...rule, active: !rule.active } : rule) });
  }

  function deleteShippingRule(id: string) {
    saveOperations({ ...operations, shippingRules: operations.shippingRules.filter((rule) => rule.id !== id) });
  }

  return (
    <main className={`admin-page ${printingQuoteId ? "printing-quote" : ""}`}>
      <aside className="admin-sidebar">
        <Link href="/" className="brand admin-brand"><span className="brand-mark">J</span><span className="brand-name">Jujubordados<span className="brand-period">.</span></span></Link>
        <p className="admin-side-label">GESTÃO DA LOJA</p>
        <a className={`admin-side-link ${section === "overview" ? "active" : ""}`} href="#overview">▦ <span>Visão geral</span></a>
        <a className={`admin-side-link ${section === "catalog" ? "active" : ""}`} href="#catalog">◈ <span>Catálogo</span></a>
        <a className={`admin-side-link ${section === "categories" ? "active" : ""}`} href="#categories">▦ <span>Categorias</span></a>
        <a className={`admin-side-link ${section === "orders" ? "active" : ""}`} href="#orders">▤ <span>Pedidos</span><small>{operations.orders.length}</small></a>
        <a className={`admin-side-link ${section === "customers" ? "active" : ""}`} href="#customers">♙ <span>Clientes</span></a>
        <a className={`admin-side-link ${section === "quotes" ? "active" : ""}`} href="#quotes">▧ <span>Orçamentos</span></a>
        <a className={`admin-side-link ${section === "coupons" ? "active" : ""}`} href="#coupons">% <span>Cupons</span></a>
        <a className={`admin-side-link ${section === "shipping" ? "active" : ""}`} href="#shipping">⌖ <span>Entrega e frete</span></a>
        <a className={`admin-side-link ${section === "metrics" ? "active" : ""}`} href="#metrics">▥ <span>Métricas</span></a>
        <a className={`admin-side-link ${section === "calendar" ? "active" : ""}`} href="#calendar">▦ <span>Calendário</span></a>
        <a className={`admin-side-link ${section === "finance" ? "active" : ""}`} href="#finance" onClick={openFinance}>◷ <span>Financeiro</span></a>
        <div className="admin-side-bottom"><span className="admin-avatar">J</span><span><strong>Jujubordados</strong><small>{isProduction ? "Painel sincronizado" : "Modo demonstração"}</small></span></div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><span className="admin-breadcrumb">Painel <span>/</span> {section === "overview" ? "Visão geral" : section === "catalog" ? "Catálogo" : section === "categories" ? "Categorias" : section === "orders" ? "Pedidos" : section === "customers" ? "Clientes" : section === "quotes" ? "Orçamentos" : section === "coupons" ? "Cupons" : section === "shipping" ? "Entrega e frete" : section === "metrics" ? "Métricas" : section === "calendar" ? "Calendário" : "Financeiro"}</span><nav className="admin-topnav" aria-label="Seções do painel">{([ ["overview", "Início"], ["catalog", "Catálogo"], ["categories", "Categorias"], ["orders", "Pedidos"], ["customers", "Clientes"], ["quotes", "Orçamentos"], ["coupons", "Cupons"], ["shipping", "Entrega"], ["metrics", "Métricas"], ["calendar", "Calendário"], ["finance", "Financeiro"] ] as const).map(([key, label]) => <a key={key} className={section === key ? "active" : ""} href={`#${key}`} aria-current={section === key ? "page" : undefined} onClick={key === "finance" ? openFinance : undefined}>{label}</a>)}</nav><Link href="/" className="admin-store-link">Ver vitrine ↗</Link></header>
        <div className="admin-content">
          {!isProduction && <div className="admin-demo-banner"><span>◉</span><div><strong>Painel de demonstração local</strong><p>Suas edições ficam apenas neste navegador. Ainda não há login, sincronização entre dispositivos ou banco de dados.</p></div><button type="button" onClick={resetCatalog}>Restaurar catálogo original</button></div>}
          {section === "overview" && <>
          <section className="admin-welcome" id="overview"><div><p className="eyebrow"><span className="eyebrow-dot" /> {isProduction ? "PAINEL DA LOJA" : "ESPAÇO DE DEMONSTRAÇÃO"}</p><h1>Um olhar sobre sua <em>loja.</em></h1><p>{isProduction ? "Resumo do catálogo e das atividades registradas da loja." : "Resumo do catálogo e das atividades registradas neste navegador."}</p></div><Link className="button button-dark" href="/#catalogo">Abrir vitrine <span>↗</span></Link></section>
          <div className="admin-metrics overview-metrics"><article><span>Produtos publicados</span><strong>{catalog.filter((product) => product.isActive !== false).length.toString().padStart(2, "0")}</strong><small>No catálogo atual</small></article><article><span>Pedidos registrados</span><strong>{operations.orders.filter((order) => order.status !== "Cancelado").length.toString().padStart(2, "0")}</strong><small>Pedidos ativos</small></article><article><span>Recebido neste mês</span><strong>{formatPrice(receivedThisMonth)}</strong><small>Entradas confirmadas no financeiro</small></article><article><span>A receber</span><strong>{formatPrice(outstandingCents)}</strong><small>{overdueOrdersCount ? `${overdueOrdersCount} pedido(s) vencido(s)` : `${outstandingOrders.length} pedido(s) com saldo`}</small></article><article><span>Clientes cadastradas</span><strong>{operations.customers.length.toString().padStart(2, "0")}</strong><small>{isProduction ? "Registros da loja" : "Registros locais"}</small></article></div>
          <PwaInstall />
          <ShareQr products={catalog} categories={categories} />
          <div className="admin-shortcuts"><a href="#orders">＋ Registrar pedido manual <span>→</span></a><a href="#customers">＋ Cadastrar cliente <span>→</span></a><a href="#catalog">◈ Gerenciar catálogo <span>→</span></a><a href="#categories">▦ Categorias e subcategorias <span>→</span></a><a href="#quotes">▧ Criar orçamento <span>→</span></a><a href="#coupons">% Gerenciar cupons <span>→</span></a><a href="#calendar">▦ Planejar datas <span>→</span></a></div>
          <section className="admin-next"><span>RECEBIMENTOS E COBRANÇAS</span><p>Registre cada parcela no pedido. O recebimento também entra no caixa; pedidos cancelados não compõem o saldo a receber. {isProduction ? "Os dados são sincronizados com o banco da loja." : "As informações desta demonstração ficam somente neste navegador."}</p></section>
          </>}
          {section === "metrics" && <StoreMetrics />}
          {section === "calendar" && <section className="admin-catalog store-calendar" id="calendar"><div className="admin-section-head"><div><p className="eyebrow">PLANEJAMENTO DA LOJA</p><h2>Calendário e datas importantes</h2><p>Organize campanhas, feiras, bazares e outras datas da Jujubordados.</p></div></div>
            <form className="admin-form-grid calendar-form" onSubmit={createCalendarEvent}><label>Nome da data<input required maxLength={120} value={calendarTitle} onChange={(event) => setCalendarTitle(event.target.value)} placeholder="Ex.: Feira de artesanato" /></label><label>Data<input required type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} /></label><label>Categoria<select value={calendarCategory} onChange={(event) => setCalendarCategory(event.target.value as CalendarCategory)}><option>Data importante</option><option>Campanha</option><option>Evento</option></select></label><label>Observações<input maxLength={2000} value={calendarNotes} onChange={(event) => setCalendarNotes(event.target.value)} placeholder="Planejamento e lembretes" /></label><button className="button button-dark" type="submit">Adicionar data</button></form>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            <CalendarSuggestions today={today} events={operations.calendarEvents} onAdd={addSeasonalSuggestion} />
            <div className="calendar-columns"><section aria-labelledby="calendar-upcoming-title"><h3 id="calendar-upcoming-title">Próximas datas</h3>{operations.calendarEvents.filter((item) => !today || item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).length ? <div className="calendar-event-list">{operations.calendarEvents.filter((item) => !today || item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).map((item) => <article className="calendar-event-card" key={item.id}><div><time dateTime={item.date}>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("pt-BR", { dateStyle: "medium", timeZone: "UTC" })}</time><span>{item.category}</span></div><h4>{item.title}</h4>{item.notes && <p>{item.notes}</p>}<button type="button" onClick={() => deleteCalendarEvent(item.id)}>Remover data</button></article>)}</div> : <p className="admin-muted">Nenhuma data futura cadastrada.</p>}</section>
              <section aria-labelledby="calendar-past-title"><h3 id="calendar-past-title">Datas passadas</h3>{operations.calendarEvents.filter((item) => today && item.date < today).sort((a, b) => b.date.localeCompare(a.date)).length ? <div className="calendar-event-list">{operations.calendarEvents.filter((item) => today && item.date < today).sort((a, b) => b.date.localeCompare(a.date)).map((item) => <article className="calendar-event-card past" key={item.id}><div><time dateTime={item.date}>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("pt-BR", { dateStyle: "medium", timeZone: "UTC" })}</time><span>{item.category}</span></div><h4>{item.title}</h4>{item.notes && <p>{item.notes}</p>}<button type="button" onClick={() => deleteCalendarEvent(item.id)}>Remover data</button></article>)}</div> : <p className="admin-muted">As datas encerradas aparecerão aqui.</p>}</section></div>
            <section className="calendar-birthdays" aria-labelledby="birthday-title"><h3 id="birthday-title">Aniversários das clientes</h3>{operations.customers.filter((customer) => customer.birthday).length ? <ul>{operations.customers.filter((customer) => customer.birthday).sort((a, b) => (a.birthday ?? "").slice(5).localeCompare((b.birthday ?? "").slice(5))).map((customer) => <li key={customer.id}><strong>{customer.name}</strong><time dateTime={customer.birthday}>{new Date(`${customer.birthday}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" })}</time></li>)}</ul> : <p className="admin-muted">Cadastre a data de aniversário no perfil da cliente para incluí-la nesta lista. Use esse dado apenas com autorização da cliente.</p>}</section>
          </section>}
          {section === "catalog" && <section className="admin-catalog" id="catalog"><div className="admin-section-head"><div><p className="eyebrow">PRODUTOS DA LOJA</p><h2>Seu catálogo</h2><p>Edite nome, categoria, preço inicial e descrição. Não adicionamos dados que não estão no site.</p><p className="admin-muted">Adicione até 5 fotos por produto; em produção, as imagens otimizadas são guardadas no banco compartilhado.</p></div><label className="admin-search">⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto" /></label></div>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUTO</th><th>CATEGORIA</th><th>PREÇO INICIAL</th><th>DISPONIBILIDADE</th><th>ESTOQUE</th><th>DESTAQUE</th><th>STATUS</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}>
              <td><input aria-label={`Nome de ${product.name}`} className="admin-input name-input" value={product.name} onChange={(event) => updateProduct(product.id, { name: event.target.value })} /><textarea aria-label={`Descrição de ${product.name}`} className="admin-input description-input" value={product.description} onChange={(event) => updateProduct(product.id, { description: event.target.value })} rows={2} /><div className="product-photo-manager"><label className={`product-photo-upload ${product.images?.length === 5 ? "disabled" : ""}`}>Fotos do produto ({product.images?.length ?? 0}/5)<input aria-label={`Adicionar fotos de ${product.name}`} type="file" accept="image/*" multiple disabled={product.images?.length === 5} onChange={(event) => void addProductPhotos(product.id, event)} /></label>{product.images?.length ? <div className="product-photo-thumbnails">{product.images.map((image, index) => <span className="product-photo-thumb" key={`${product.id}-photo-${index}`}><Image src={image} alt={`${product.name}, foto ${index + 1}`} fill sizes="56px" unoptimized /><button type="button" aria-label={`Remover foto ${index + 1} de ${product.name}`} onClick={() => removeProductPhoto(product.id, index)}>×</button>{index === 0 && <small>Capa</small>}</span>)}</div> : <small className="admin-muted">Ainda não há fotos próprias; a ilustração é temporária.</small>}</div></td>
              <td><select aria-label={`Categoria de ${product.name}`} className="admin-input" value={categories.find((category) => category.name === (product.subcategory ?? product.category) && (product.subcategory ? Boolean(category.parentId) : !category.parentId))?.id ?? "unassigned"} onChange={(event) => event.target.value !== "unassigned" && updateProductCategory(product.id, event.target.value)}><option value="unassigned" disabled>Sem categoria</option>{categories.filter((category) => !category.parentId).map((category) => <optgroup key={category.id} label={category.name}><option value={category.id}>{category.name}</option>{categories.filter((child) => child.parentId === category.id).map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</optgroup>)}</select></td>
              <td><div className="admin-variant-prices">{product.sizes.map((option, index) => <label key={`${product.id}-${option.label}`}>{product.sizes.length > 1 ? option.label : "Preço do item"}<span>R$ <input aria-label={`Preço de ${option.label} para ${product.name}`} className="admin-input price-input" type="number" min="0" step="0.01" required defaultValue={(option.priceCents / 100).toFixed(2)} key={`${product.id}-${option.label}-${option.priceCents}`} onBlur={(event) => updateProductOptionPrice(product, index, event.currentTarget)} /></span></label>)}</div><small className="admin-muted">Menor preço: {formatPrice(Math.min(...product.sizes.map((option) => option.priceCents)))}</small></td>
              <td><input aria-label={`Disponibilidade de ${product.name}`} className="admin-input" value={product.availability} onChange={(event) => updateProduct(product.id, { availability: event.target.value })} />{product.availabilityNeedsReview && <small className="admin-review">Conferir conflito no site</small>}</td>
              <td><input aria-label={`Estoque de ${product.name}`} className="admin-input stock-input" type="number" min="0" step="1" placeholder="Sem controle" value={product.stockQuantity ?? ""} onChange={(event) => { const raw = event.target.value; const count = raw === "" ? undefined : Math.max(0, Math.floor(Number(raw))); if (raw === "" || Number.isFinite(count)) updateProduct(product.id, { stockQuantity: count }); }} /><small className={`admin-stock-note ${product.stockQuantity === 0 ? "out-of-stock" : product.stockQuantity !== undefined && product.lowStockThreshold !== undefined && product.stockQuantity <= product.lowStockThreshold ? "low-stock" : ""}`}>{product.stockQuantity === undefined ? "Sem controle de estoque" : product.stockQuantity === 0 ? "Esgotado · oculto da vitrine" : `${product.stockQuantity} disponível(is)`}</small><label className="admin-threshold-label">Avisar com<input aria-label={`Limite de estoque baixo de ${product.name}`} className="admin-input threshold-input" type="number" min="0" step="1" placeholder="Limite opcional" value={product.lowStockThreshold ?? ""} onChange={(event) => { const raw = event.target.value; const threshold = raw === "" ? undefined : Math.max(0, Math.floor(Number(raw))); if (raw === "" || Number.isFinite(threshold)) updateProduct(product.id, { lowStockThreshold: threshold }); }} /></label></td>
              <td><label className="featured-toggle"><input type="checkbox" checked={product.featured} onChange={(event) => updateProduct(product.id, { featured: event.target.checked })} /><span>{product.featured ? "Na página inicial" : "Não destacado"}</span></label></td>
              <td><span className="status-pill"><i /> No catálogo</span></td>
            </tr>)}</tbody></table></div>
            {!filtered.length && <p className="admin-no-results">Nenhum produto corresponde à busca.</p>}
            <p className="admin-footnote">Edite o preço de cada tamanho ou variação. A vitrine recalcula automaticamente o preço inicial exibido para cada produto.</p>
          </section>}
          {section === "categories" && <section className="admin-catalog" id="categories"><div className="admin-section-head"><div><p className="eyebrow">ORGANIZAÇÃO DA VITRINE</p><h2>Categorias e subcategorias</h2><p>Organize a navegação da vitrine e associe seus produtos sem perder itens ao remover uma categoria.</p></div></div>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            <form className="admin-form-grid category-admin-form" onSubmit={createCategory}><label>Nome<input required maxLength={48} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nome da categoria" /></label><label>Categoria principal<select value={subcategoryParent} onChange={(event) => setSubcategoryParent(event.target.value)}><option value="">Criar categoria principal</option>{categories.filter((category) => !category.parentId).map((category) => <option key={category.id} value={category.id}>Subcategoria de {category.name}</option>)}</select></label><button className="button button-dark" type="submit">Criar categoria</button></form>
            {!categories.length ? <div className="admin-empty-state"><span>▦</span><h3>Nenhuma categoria</h3><p>Crie uma categoria para organizar seus produtos.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CATEGORIA</th><th>PRODUTOS VINCULADOS</th><th>AÇÕES</th></tr></thead><tbody>{categories.filter((category) => !category.parentId).map((category) => <Fragment key={category.id}><tr><td><input className="admin-input name-input" aria-label={`Nome da categoria ${category.name}`} defaultValue={category.name} key={`${category.id}:${category.name}`} onBlur={(event) => renameCategory(category.id, event.target.value)} /><small className="admin-muted">Categoria principal</small></td><td>{catalog.filter((product) => product.category === category.name).length}</td><td><button type="button" onClick={() => deleteCategory(category.id)}>Excluir</button></td></tr>{categories.filter((subcategory) => subcategory.parentId === category.id).map((subcategory) => <tr key={subcategory.id}><td><span className="subcategory-indent">↳</span><input className="admin-input name-input" aria-label={`Nome da subcategoria ${subcategory.name}`} defaultValue={subcategory.name} key={`${subcategory.id}:${subcategory.name}`} onBlur={(event) => renameCategory(subcategory.id, event.target.value)} /><small className="admin-muted">Subcategoria de {category.name}</small></td><td>{catalog.filter((product) => product.subcategory === subcategory.name).length}</td><td><button type="button" onClick={() => deleteCategory(subcategory.id)}>Excluir</button></td></tr>)}</Fragment>)}</tbody></table></div>}
            <p className="admin-footnote">Ao excluir uma categoria principal, seus produtos são mantidos no catálogo como “Sem categoria” e as subcategorias também são removidas. Ao excluir uma subcategoria, os produtos continuam na categoria principal.</p>
          </section>}
          {section === "orders" && <section className="admin-catalog" id="orders"><div className="admin-section-head"><div><p className="eyebrow">ACOMPANHAMENTO DA LOJA</p><h2>Pedidos</h2><p>Registre pedidos manuais e acompanhe cada etapa.</p></div><button className="button button-dark admin-add-button" type="button" onClick={() => setShowNewOrder(!showNewOrder)}>{showNewOrder ? "Fechar formulário" : "+ Novo pedido"}</button></div>
            {showNewOrder && <form className="admin-form-grid" onSubmit={createOrder}><label>Nome da cliente<input required value={orderName} onChange={(event) => setOrderName(event.target.value)} /></label><label>WhatsApp (opcional)<input inputMode="tel" value={orderPhone} onChange={(event) => setOrderPhone(event.target.value)} /></label><label>Itens ou descrição<input required value={orderDescription} onChange={(event) => setOrderDescription(event.target.value)} /></label><label>Valor total (R$)<input required inputMode="decimal" placeholder="0,00" value={orderTotal} onChange={(event) => setOrderTotal(event.target.value)} /></label><label>Vencimento (opcional)<input name="dueDate" type="date" /></label><button className="button button-dark" type="submit">Salvar pedido</button></form>}
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            {!operations.orders.length ? <div className="admin-empty-state"><span>✳</span><h3>Nenhum pedido registrado</h3><p>Os pedidos finalizados na vitrine ainda são enviados pelo WhatsApp. Você pode registrar um pedido manual para experimentar o acompanhamento.</p><button type="button" onClick={() => setShowNewOrder(true)}>Registrar pedido de demonstração</button></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>ITENS</th><th>VALOR E RECEBIMENTOS</th><th>STATUS</th></tr></thead><tbody>{operations.orders.map((order) => { const payments = order.payments ?? []; const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0); const balanceCents = Math.max(0, order.totalCents - paidCents); return <tr key={order.id}><td><strong>{order.id}</strong><small className="admin-muted">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</small></td><td>{order.customerName}<small className="admin-muted">{order.customerPhone || "Sem telefone informado"}</small></td><td>{order.description}</td><td><div className="order-balance-summary"><strong>Total: {formatPrice(order.totalCents)}</strong><span>Recebido: {formatPrice(paidCents)}</span><span>Saldo: {formatPrice(balanceCents)}</span>{order.dueDate && <small>Vencimento: {new Date(`${order.dueDate}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}{order.dueDate < today && balanceCents > 0 ? " · Vencido" : ""}</small>}</div>{payments.length > 0 && <details className="order-payment-history"><summary>{payments.length} recebimento(s)</summary><ul>{payments.map((payment) => <li key={payment.id}>{formatPrice(payment.amountCents)} · {new Date(payment.receivedAt).toLocaleDateString("pt-BR")}</li>)}</ul></details>}{balanceCents > 0 && order.status !== "Cancelado" && <form className="order-payment-form" onSubmit={(event) => recordOrderPayment(event, order.id)}><label htmlFor={`receipt-${order.id}`}>Novo recebimento</label><div><input id={`receipt-${order.id}`} type="text" inputMode="decimal" placeholder="0,00" value={paymentAmounts[order.id] ?? ""} onChange={(event) => setPaymentAmounts((current) => ({ ...current, [order.id]: event.target.value }))} /><button type="submit">Registrar</button></div></form>}<small className="admin-muted">Pagamento {order.paymentStatus.toLowerCase()}</small></td><td><select aria-label={`Status do pedido ${order.id}`} className="admin-input" value={order.status} onChange={(event) => changeOrderStatus(order.id, event.target.value as OrderStatus)}>{["Novo", "Em produção", "Pronto", "Concluído", "Cancelado"].map((status) => <option key={status}>{status}</option>)}</select></td></tr>; })}</tbody></table></div>}
          </section>}
          {section === "customers" && <section className="admin-catalog" id="customers"><div className="admin-section-head"><div><p className="eyebrow">RELACIONAMENTO</p><h2>Clientes</h2><p>Guarde informações apenas para atendimento e gestão dos pedidos. Registre aniversário somente com autorização da cliente.</p></div></div>
            <form className="admin-form-grid" onSubmit={createCustomer}><label>Nome da cliente<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label>WhatsApp<input inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label><label>E-mail<input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label><label>Aniversário<input type="date" value={customerBirthday} onChange={(event) => setCustomerBirthday(event.target.value)} /></label><label>Observações<input value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} /></label><button className="button button-dark" type="submit">Salvar cliente</button></form>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            {!operations.customers.length ? <div className="admin-empty-state"><span>♡</span><h3>Nenhuma cliente cadastrada</h3><p>Os dados de clientes precisam ser tratados com cuidado. Nesta demonstração, tudo permanece no armazenamento local deste navegador.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>NOME</th><th>WHATSAPP</th><th>E-MAIL</th><th>ANIVERSÁRIO</th><th>OBSERVAÇÕES</th><th>HISTÓRICO DE PEDIDOS</th></tr></thead><tbody>{operations.customers.map((customer) => { const customerPhoneDigits = customer.phone.replace(/\D/g, ""); const customerOrders = customerPhoneDigits ? operations.orders.filter((order) => order.customerPhone.replace(/\D/g, "") === customerPhoneDigits).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []; const isExpanded = expandedCustomerId === customer.id; return <Fragment key={customer.id}><tr><td>{customer.name}</td><td>{customer.phone || "—"}</td><td>{customer.email || "—"}</td><td>{customer.birthday ? new Date(`${customer.birthday}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}</td><td>{customer.notes || "—"}</td><td><button type="button" className="customer-history-toggle" aria-expanded={isExpanded} aria-controls={`history-${customer.id}`} onClick={() => setExpandedCustomerId(isExpanded ? "" : customer.id)}>{customerOrders.length} {customerOrders.length === 1 ? "pedido" : "pedidos"} · {isExpanded ? "Fechar histórico" : "Ver histórico"}</button></td></tr>{isExpanded && <tr id={`history-${customer.id}`}><td colSpan={6}><div className="customer-order-history">{customerOrders.length ? customerOrders.map((order) => <article key={order.id}><div><strong>{order.id}</strong><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</time></div><p>{order.description}</p><div><strong>{formatPrice(order.totalCents)}</strong><span>{order.status} · Pagamento {order.paymentStatus.toLowerCase()}</span></div></article>) : <p className="admin-muted">Nenhum pedido com este WhatsApp foi encontrado.</p>}</div></td></tr>}</Fragment>; })}</tbody></table></div>}
            <button className="admin-reset-data" type="button" onClick={resetDemoData}>Limpar todos os pedidos e clientes deste navegador</button>
          </section>}
          {section === "quotes" && <section className="admin-catalog" id="quotes"><div className="admin-section-head"><div><p className="eyebrow">PROPOSTAS PERSONALIZADAS</p><h2>Orçamentos</h2><p>Monte uma proposta com validade, entrega prevista e sinal opcional. Use Imprimir para salvar como PDF.</p></div></div>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            <form className="admin-form-grid quote-form" onSubmit={createQuote}>
              <label>Nome da cliente<input required maxLength={120} value={quoteName} onChange={(event) => setQuoteName(event.target.value)} /></label>
              <label>WhatsApp (opcional)<input inputMode="tel" maxLength={40} value={quotePhone} onChange={(event) => setQuotePhone(event.target.value)} /></label>
              <fieldset className="quote-items-field"><legend>Itens do orçamento</legend>{quoteItems.map((item, index) => <div className="quote-item-draft" key={index}><label>Produto ou serviço<input required maxLength={250} value={item.description} onChange={(event) => setQuoteItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} /></label><label>Quantidade<input required type="number" min="1" max="10000" step="1" value={item.quantity} onChange={(event) => setQuoteItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></label><label>Valor unitário (R$)<input required inputMode="decimal" placeholder="0,00" value={item.unitPrice} onChange={(event) => setQuoteItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: event.target.value } : row))} /></label><button className="quote-remove-item" type="button" disabled={quoteItems.length === 1} onClick={() => setQuoteItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remover item</button></div>)}<button className="quote-add-item" type="button" disabled={quoteItems.length >= 30} onClick={() => setQuoteItems((current) => [...current, { description: "", quantity: "1", unitPrice: "" }])}>＋ Adicionar item</button></fieldset>
              <label>Sinal solicitado (%)<input inputMode="decimal" min="0" max="100" placeholder="Opcional" value={quoteDeposit} onChange={(event) => setQuoteDeposit(event.target.value)} /></label>
              <label>Validade até<input required type="date" value={quoteValidUntil} onChange={(event) => setQuoteValidUntil(event.target.value)} /></label>
              <label>Entrega prevista<input required type="date" value={quoteDeliveryDate} onChange={(event) => setQuoteDeliveryDate(event.target.value)} /></label>
              <label className="quote-notes-field">Observações<textarea rows={2} maxLength={2000} value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} /></label>
              <div className="quote-form-actions"><button className="button button-dark" type="submit">{editingQuoteId ? "Salvar alterações" : "Salvar orçamento"}</button>{editingQuoteId && <button className="quote-cancel-edit" type="button" onClick={resetQuoteDraft}>Cancelar edição</button>}</div>
            </form>
            {!operations.quotes.length ? <div className="admin-empty-state"><span>▧</span><h3>Nenhum orçamento salvo</h3><p>Os orçamentos são sincronizados com a loja. Use Imprimir / PDF para salvar uma cópia pelo dispositivo.</p></div> : <div className="quote-list">{operations.quotes.map((quote) => { const items = quoteLineItems(quote); const total = quoteTotalCents(quote); const remaining = Math.max(0, total - quote.depositCents); return <article key={quote.id} className={`quote-card ${printingQuoteId === quote.id ? "print-selected" : ""}`}><div className="quote-card-head"><div><span className="quote-id">{quote.id}</span><h3>{quote.customerName}</h3><small>{new Date(quote.createdAt).toLocaleDateString("pt-BR")}</small></div><span className={`quote-status ${quote.status === "Aprovado" ? "approved" : ""}`}>{quote.status}</span></div><div className="quote-card-body">{items.map((item, index) => <div className="quote-line" key={`${quote.id}-item-${index}`}><span>{item.quantity} × {item.description}<small className="quote-unit-price">{formatPrice(item.unitPriceCents)} cada</small></span><strong>{formatPrice(item.quantity * item.unitPriceCents)}</strong></div>)}<div className="quote-detail-row quote-total-row"><strong>Total</strong><strong>{formatPrice(total)}</strong></div>{quote.depositCents > 0 && <><div className="quote-detail-row"><span>Sinal solicitado</span><span>{formatPrice(quote.depositCents)}</span></div><div className="quote-detail-row"><span>Saldo restante</span><span>{formatPrice(remaining)}</span></div></>}{quote.validUntil && <div className="quote-detail-row"><span>Validade</span><span>{new Date(`${quote.validUntil}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span></div>}{quote.deliveryDate && <div className="quote-detail-row"><span>Entrega prevista</span><span>{new Date(`${quote.deliveryDate}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span></div>}{quote.notes && <p className="quote-notes">{quote.notes}</p>}</div><div className="quote-card-actions"><label className="quote-status-control">Status<select aria-label={`Status do orçamento ${quote.id}`} data-quote-id={quote.id} value={quote.status} disabled={quote.status === "Convertido em pedido"} onChange={updateQuoteStatus}>{["Em aberto", "Aprovado", "Recusado", "Convertido em pedido"].map((status) => <option key={status}>{status}</option>)}</select></label>{quote.status === "Em aberto" && <button type="button" onClick={() => editQuote(quote)}>Editar</button>}<button type="button" onClick={() => sendQuoteToWhatsApp(quote)}>WhatsApp</button><button type="button" onClick={() => printQuote(quote.id)}>Imprimir / PDF</button>{confirmQuoteDeleteId === quote.id ? <span className="quote-delete-confirm">Remover este orçamento?<button type="button" onClick={() => confirmDeleteQuote(quote.id)}>Confirmar</button><button type="button" onClick={() => setConfirmQuoteDeleteId("")}>Cancelar</button></span> : <button type="button" onClick={() => deleteQuote(quote.id)}>Excluir</button>}</div></article>; })}</div>}
          </section>}
          {section === "coupons" && <section className="admin-catalog" id="coupons"><div className="admin-section-head"><div><p className="eyebrow">PROMOÇÕES DA VITRINE</p><h2>Cupons de desconto</h2><p>Cupons ativos podem ser aplicados na sacola e sincronizam com a vitrine.</p></div></div>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            <form className="admin-form-grid coupon-admin-form" onSubmit={createCoupon}><label>Código<input required minLength={2} maxLength={24} pattern="[A-Za-z0-9-]{2,24}" autoCapitalize="characters" autoComplete="off" placeholder="Ex.: BEMVINDA10" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} /></label><label>Tipo de desconto<select value={couponType} onChange={(event) => setCouponType(event.target.value as "percentage" | "fixed")}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>Desconto {couponType === "percentage" ? "(%)" : "(R$)"}<input required type="text" inputMode="decimal" placeholder={couponType === "percentage" ? "10" : "5,00"} value={couponAmount} onChange={(event) => setCouponAmount(event.target.value)} /></label><button className="button button-dark" type="submit">Criar cupom</button></form>
            <p className="coupon-limitation">Limite de uso único por cliente ainda não está disponível: o fechamento atual é revisado e enviado pelo WhatsApp, sem registro de consumo do cupom.</p>
            {!operations.coupons.length ? <div className="admin-empty-state"><span>%</span><h3>Nenhum cupom cadastrado</h3><p>Crie um código de desconto para que ele possa ser aplicado na sacola da vitrine.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CÓDIGO</th><th>DESCONTO</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{operations.coupons.map((coupon) => <tr key={coupon.id}><td><strong className="coupon-code">{coupon.code}</strong></td><td>{coupon.discountType === "percentage" ? `${coupon.amount}%` : formatPrice(coupon.amount)}</td><td><span className={`coupon-state ${coupon.active ? "active" : "paused"}`}>{coupon.active ? "Ativo" : "Pausado"}</span></td><td className="coupon-actions">{confirmCouponDeleteId === coupon.id ? <span className="quote-delete-confirm">Remover?<button type="button" onClick={() => confirmDeleteCoupon(coupon.id)}>Confirmar</button><button type="button" onClick={() => setConfirmCouponDeleteId("")}>Cancelar</button></span> : <><button type="button" onClick={() => toggleCoupon(coupon.id)}>{coupon.active ? "Pausar" : "Ativar"}</button><button type="button" onClick={() => setConfirmCouponDeleteId(coupon.id)}>Excluir</button></>}</td></tr>)}</tbody></table></div>}
          </section>}
          {section === "shipping" && <section className="admin-catalog" id="shipping"><div className="admin-section-head"><div><p className="eyebrow">RETIRADA E ENTREGA</p><h2>Regras de frete local</h2><p>Configure valores informados pela loja para CEP, cidade, UF ou região.</p></div></div>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            <form className="admin-form-grid shipping-rule-form" onSubmit={createShippingRule}><label>Nome da regra<input required value={shippingLabel} onChange={(event) => setShippingLabel(event.target.value)} placeholder="Ex.: Entrega no centro" /></label><label>Aplicar por<select value={shippingMatchType} onChange={(event) => setShippingMatchType(event.target.value as LocalShippingRule["matchType"])}><option value="cep">CEP ou prefixo</option><option value="city">Cidade</option><option value="state">Estado (UF)</option><option value="region">Região (cidade ou UF)</option></select></label><label>CEP, cidade, UF ou região<input required value={shippingMatchValue} onChange={(event) => setShippingMatchValue(event.target.value)} placeholder={shippingMatchType === "cep" ? "00000-000 ou prefixo 00000" : "Informe a região"} /></label><label>Frete (R$)<input required inputMode="decimal" value={shippingPrice} onChange={(event) => setShippingPrice(event.target.value)} placeholder="0,00" /></label><button className="button button-dark" type="submit">Adicionar regra</button></form>
            <p className="coupon-limitation">A retirada continua disponível sem custo de frete. Não há consulta automática de CEP nem integração com transportadoras; a regra compatível mais específica é aplicada e a loja confirma o pedido pelo WhatsApp.</p>
            {!operations.shippingRules.length ? <div className="admin-empty-state"><span>⌖</span><h3>Nenhuma regra cadastrada</h3><p>Cadastre as tarifas e áreas de atendimento definidas pela loja. Não presumimos valores ou cidades.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>REGRA</th><th>ÁREA</th><th>FRETE</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{operations.shippingRules.map((rule) => <tr key={rule.id}><td>{rule.label}</td><td>{rule.matchType === "cep" ? "CEP" : rule.matchType === "city" ? "Cidade" : rule.matchType === "state" ? "UF" : "Região"}: {rule.matchValue}</td><td>{formatPrice(rule.priceCents)}</td><td><span className={`coupon-state ${rule.active ? "active" : "paused"}`}>{rule.active ? "Ativa" : "Pausada"}</span></td><td className="coupon-actions"><button type="button" onClick={() => toggleShippingRule(rule.id)}>{rule.active ? "Pausar" : "Ativar"}</button><button type="button" onClick={() => deleteShippingRule(rule.id)}>Excluir</button></td></tr>)}</tbody></table></div>}
          </section>}
          {section === "finance" && <section className="admin-catalog" id="finance"><div className="admin-section-head"><div><p className="eyebrow">CONTROLE DE CAIXA</p><h2>Financeiro</h2><p>Recebimentos registrados nos pedidos entram aqui automaticamente. Use o formulário para entradas avulsas e despesas pagas.</p></div></div>
            {notice && <p className="admin-notice" role="status">✓ {notice}</p>}
            {(() => { const entries = currentMonth ? operations.financeEntries.filter((entry) => entry.date.startsWith(currentMonth)) : []; const income = entries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amountCents, 0); const expenses = entries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amountCents, 0); const progress = operations.monthlyGoalCents > 0 ? Math.min(100, Math.round(income / operations.monthlyGoalCents * 100)) : 0; return <>
              <div className="admin-metrics finance-metrics"><article><span>Recebido neste mês</span><strong>{formatPrice(income)}</strong><small>Somente lançamentos confirmados</small></article><article><span>Despesas lançadas</span><strong>{formatPrice(expenses)}</strong><small>Somente registros manuais</small></article><article><span>Saldo registrado</span><strong>{formatPrice(income - expenses)}</strong><small>Entradas menos despesas do mês</small></article></div>
              <div className="finance-goal"><div><strong>Meta mensal</strong><span>{operations.monthlyGoalCents ? `${formatPrice(income)} de ${formatPrice(operations.monthlyGoalCents)} · ${progress}%` : "Defina uma meta para acompanhar o progresso"}</span></div><div className="finance-progress"><i style={{ width: `${progress}%` }} /></div><form className="goal-form" onSubmit={saveMonthlyGoal}><label htmlFor="monthly-goal">Meta em R$</label><input id="monthly-goal" inputMode="decimal" placeholder="Ex.: 2000,00" value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} /><button type="submit">Salvar meta</button></form></div>
              <form className="admin-form-grid finance-entry-form" onSubmit={addFinanceEntry}><label>Tipo de lançamento<select value={financeKind} onChange={(event) => { const next = event.target.value as "income" | "expense"; setFinanceKind(next); setFinanceCategory(next === "income" ? "Vendas" : "Matéria-prima"); }}><option value="income">Recebimento confirmado</option><option value="expense">Despesa paga</option></select></label><label>Categoria<select value={financeCategory} onChange={(event) => setFinanceCategory(event.target.value)}>{(financeKind === "income" ? ["Vendas", "Outros recebimentos"] : ["Matéria-prima", "Embalagens", "Marketing", "Transporte", "Equipamentos", "Outros"]).map((category) => <option key={category}>{category}</option>)}</select></label><label>Descrição<input required value={financeDescription} onChange={(event) => setFinanceDescription(event.target.value)} /></label><label>Valor (R$)<input required inputMode="decimal" placeholder="0,00" value={financeAmount} onChange={(event) => setFinanceAmount(event.target.value)} /></label><label>Data<input required type="date" value={financeDate} onChange={(event) => setFinanceDate(event.target.value)} /></label><button className="button button-dark" type="submit">Registrar {financeKind === "income" ? "recebimento" : "despesa"}</button></form>
              {!entries.length ? <div className="admin-empty-state"><span>◷</span><h3>Nenhum lançamento neste mês</h3><p>Quando registrar entradas ou despesas, o resumo mensal será calculado aqui. Nenhum valor fictício foi adicionado.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>DATA</th><th>TIPO</th><th>CATEGORIA</th><th>DESCRIÇÃO</th><th>VALOR</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td><span className={entry.kind === "income" ? "finance-income" : "finance-expense"}>{entry.kind === "income" ? "Recebimento" : "Despesa"}</span></td><td>{entry.category}</td><td>{entry.description}</td><td>{formatPrice(entry.amountCents)}</td></tr>)}</tbody></table></div>}
            </>; })()}
          </section>}
        </div>
      </section>
    </main>
  );
}
