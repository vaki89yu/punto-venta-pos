"use client";

import { normalizeBarcode as normalizeRawBarcode, findBarcodeMatch } from "@/lib/barcodes";
import { Product } from "@/types";

export { normalizeBarcode } from "@/lib/barcodes";
type Listener = () => void;
let cache: Product[] | null = null;
let pendingRefresh: Promise<Product[]> | null = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

async function parseApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return new Error(payload?.error?.message || `Error del servidor (${response.status}).`);
}

export function getSnapshot(): Product[] { return cache || []; }
export function getServerSnapshot(): Product[] { return []; }

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refresh(): Promise<Product[]> {
  if (typeof window === "undefined") return [];
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = fetch("/api/products", { credentials: "same-origin", cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw await parseApiError(response);
      const payload = await response.json() as { products?: Product[] };
      cache = Array.isArray(payload.products) ? payload.products : [];
      notify();
      return cache;
    })
    .finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

export async function addProductToStore(product: Product): Promise<Product> {
  const response = await fetch("/api/products", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...product, barcode: normalizeRawBarcode(product.barcode) }),
  });
  if (!response.ok) throw await parseApiError(response);
  const payload = await response.json() as { product: Product };
  const saved = payload.product;
  cache = [saved, ...(cache || []).filter((item) => item.id !== saved.id)];
  notify();
  return saved;
}

export async function updateProductInStore(id: string, updates: Partial<Product> & { stockReason?: string; marginOverrideReason?: string }): Promise<Product> {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...updates, ...(updates.barcode ? { barcode: normalizeRawBarcode(updates.barcode) } : {}) }),
  });
  if (!response.ok) throw await parseApiError(response);
  const payload = await response.json() as { product: Product };
  cache = (cache || []).map((product) => product.id === id ? payload.product : product);
  notify();
  return payload.product;
}

export async function deleteProductFromStore(id: string): Promise<void> {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  if (!response.ok) throw await parseApiError(response);
  cache = (cache || []).filter((product) => product.id !== id);
  notify();
}

export function findByBarcode(code: string): Product | undefined {
  const products = getSnapshot();
  if (!normalizeRawBarcode(code)) return undefined;
  return findBarcodeMatch(products, code) || products.find((product) => (product.sku || "").trim().toLowerCase() === normalizeRawBarcode(code).toLowerCase());
}
