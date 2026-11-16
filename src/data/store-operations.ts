export type OrderStatus = "Novo" | "Em produção" | "Pronto" | "Concluído" | "Cancelado";

export type LocalOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  description: string;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
  paymentStatus: "Pendente" | "Parcial" | "Pago";
  dueDate?: string;
  payments?: LocalPayment[];
  items?: Array<{ productName: string; quantity: number; size: string; color: string; unitPriceCents?: number }>;
};

export type LocalPayment = {
  id: string;
  amountCents: number;
  receivedAt: string;
};

export type LocalCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  birthday?: string;
};

export type CalendarCategory = "Campanha" | "Evento" | "Data importante";

export type LocalCalendarEvent = {
  id: string;
  title: string;
  date: string;
  category: CalendarCategory;
  notes: string;
};

export type FinanceEntry = {
  id: string;
  kind: "income" | "expense";
  category: string;
  description: string;
  amountCents: number;
  date: string;
  relatedOrderId?: string;
};

export type QuoteStatus = "Em aberto" | "Aprovado" | "Recusado" | "Convertido em pedido";

export type LocalQuoteItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  productId?: string;
  variantLabel?: string;
};

export type LocalQuote = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerId?: string;
  itemDescription: string;
  quantity: number;
  unitPriceCents: number;
  validUntil: string;
  deliveryDate: string;
  depositCents: number;
  /** New multi-item format; absent for quotes saved by earlier versions. */
  items?: LocalQuoteItem[];
  notes: string;
  status: QuoteStatus;
  createdAt: string;
};

export type LocalCoupon = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  amount: number;
  active: boolean;
};

export type LocalShippingRule = {
  id: string;
  label: string;
  matchType: "cep" | "city" | "state" | "region";
  matchValue: string;
  priceCents: number;
  active: boolean;
};

export type Operations = { orders: LocalOrder[]; customers: LocalCustomer[]; financeEntries: FinanceEntry[]; monthlyGoalCents: number; quotes: LocalQuote[]; coupons: LocalCoupon[]; shippingRules: LocalShippingRule[]; calendarEvents: LocalCalendarEvent[] };

const STORAGE_KEY = "jujubordados:operations:v1";
export const EMPTY_OPERATIONS: Operations = { orders: [], customers: [], financeEntries: [], monthlyGoalCents: 0, quotes: [], coupons: [], shippingRules: [], calendarEvents: [] };
const EMPTY = EMPTY_OPERATIONS;
let snapshot = JSON.stringify(EMPTY);
const listeners = new Set<() => void>();

export function getOperationsSnapshot() {
  if (typeof window === "undefined") return JSON.stringify(EMPTY);
  try {
    snapshot = window.localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(EMPTY);
  } catch { /* Retain the in-memory data when storage is unavailable. */ }
  return snapshot;
}

export function getServerOperationsSnapshot() { return JSON.stringify(EMPTY); }

export function subscribeToOperations(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function saveOperations(value: Operations) {
  snapshot = JSON.stringify(value);
  try { window.localStorage.setItem(STORAGE_KEY, snapshot); } catch { /* Keep this tab usable. */ }
  listeners.forEach((listener) => listener());
}

export function parseOperations(value: string): Operations {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && "orders" in parsed && "customers" in parsed && Array.isArray(parsed.orders) && Array.isArray(parsed.customers)) {
      const old = parsed as Partial<Operations>;
      return { orders: old.orders ?? [], customers: old.customers ?? [], financeEntries: old.financeEntries ?? [], monthlyGoalCents: old.monthlyGoalCents ?? 0, quotes: old.quotes ?? [], coupons: old.coupons ?? [], shippingRules: old.shippingRules ?? [], calendarEvents: old.calendarEvents ?? [] };
    }
  } catch { /* Use an empty local workspace if stored JSON is invalid. */ }
  return EMPTY;
}
