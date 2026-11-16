import { categories as initialCategories, products, type StoreProduct } from "@/data/catalog";

const STORAGE_KEY = "jujubordados:catalog:v1";
const CATEGORIES_STORAGE_KEY = "jujubordados:categories:v1";
let snapshot = JSON.stringify(products);
const listeners = new Set<() => void>();
let categorySnapshot = JSON.stringify(initialCategories.map((name) => ({ id: `category-${name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`, name, parentId: null as string | null })));
const categoryListeners = new Set<() => void>();

export type StoreCategory = { id: string; name: string; parentId: string | null };

export function getCategorySnapshot() {
  if (typeof window === "undefined") return categorySnapshot;
  try { categorySnapshot = window.localStorage.getItem(CATEGORIES_STORAGE_KEY) ?? categorySnapshot; } catch { /* Keep in-memory categories. */ }
  return categorySnapshot;
}

export function getServerCategorySnapshot() { return JSON.stringify(initialCategories.map((name) => ({ id: `category-${name.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`, name, parentId: null }))); }

export function subscribeToCategories(listener: () => void) {
  categoryListeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => { categoryListeners.delete(listener); if (typeof window !== "undefined") window.removeEventListener("storage", listener); };
}

export function parseCategories(snapshot: string): StoreCategory[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (Array.isArray(parsed)) return parsed.filter((item): item is StoreCategory => typeof item === "object" && item !== null && "id" in item && typeof item.id === "string" && "name" in item && typeof item.name === "string" && "parentId" in item && (typeof item.parentId === "string" || item.parentId === null));
  } catch { /* Restore the original set if saved category data is invalid. */ }
  return JSON.parse(getServerCategorySnapshot()) as StoreCategory[];
}

export function saveCategories(next: StoreCategory[]) {
  const valid = next.filter((category) => category.name.trim() && (!category.parentId || next.some((parent) => parent.id === category.parentId && !parent.parentId)));
  categorySnapshot = JSON.stringify(valid);
  try { window.localStorage.setItem(CATEGORIES_STORAGE_KEY, categorySnapshot); } catch { /* Keep in-memory categories. */ }
  categoryListeners.forEach((listener) => listener());
}

export function getStoreCategories() { return parseCategories(getCategorySnapshot()); }

export function getCatalogSnapshot() {
  if (typeof window === "undefined") return JSON.stringify(products);
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      snapshot = JSON.stringify(products);
    } else {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const migrated = (parsed as StoreProduct[]).map((product) => {
          const current = products.find((item) => item.id === product.id);
          const hasTemporaryImage = product.image?.endsWith("-ilustrativa.svg");
          if (current && (hasTemporaryImage || !product.images?.length)) {
            return { ...product, image: current.image, images: current.images };
          }
          return product;
        });
        snapshot = JSON.stringify(migrated);
        if (snapshot !== saved) window.localStorage.setItem(STORAGE_KEY, snapshot);
      } else {
        snapshot = JSON.stringify(products);
      }
    }
  } catch {
    // Preserve the in-memory snapshot when local storage is unavailable.
  }
  return snapshot;
}

export function getServerCatalogSnapshot() {
  return JSON.stringify(products);
}

export function subscribeToCatalog(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function saveCatalog(nextProducts: StoreProduct[]) {
  snapshot = JSON.stringify(nextProducts);
  let savedToBrowser = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    savedToBrowser = false;
  }
  listeners.forEach((listener) => listener());
  return savedToBrowser;
}

