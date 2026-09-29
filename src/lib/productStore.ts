"use client";

import { normalizeBarcode, findBarcodeMatch } from "@/lib/barcodes";
export { normalizeBarcode } from "@/lib/barcodes";

import { Product } from "@/types";
import { STORAGE_KEYS, demoProducts } from "@/data/seed";

/**
 * Store global de productos.
 *
 * Problema que resuelve:
 * Antes cada componente tenía su propia copia con useState, lo que provocaba
 * desincronización (registrabas un producto en el POS y otra pantalla lo
 * sobrescribía con su copia vieja, perdiéndolo).
 *
 * Ahora hay UNA sola fuente de verdad:
 *  - Todas las escrituras releen localStorage antes de modificar
 *  - Todos los suscriptores se notifican al instante
 *  - Se sincroniza entre pestañas del navegador
 */

type Listener = () => void;

let cache: Product[] | null = null;
const listeners = new Set<Listener>();

function readStorage(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error leyendo productos:", e);
  }
  // Primera vez: sembrar catálogo demo
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(demoProducts));
  return demoProducts;
}

function writeStorage(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    cache = products;
    listeners.forEach((l) => l());
  } catch (e) {
    console.error("Error guardando productos:", e);
  }
}

/** Snapshot estable para useSyncExternalStore */
export function getSnapshot(): Product[] {
  if (cache === null) cache = readStorage();
  return cache;
}

export function getServerSnapshot(): Product[] {
  return [];
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  // Sincronizar entre pestañas del navegador
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.PRODUCTS) {
      cache = null;
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Fuerza recarga desde localStorage */
export function refresh() {
  cache = null;
  listeners.forEach((l) => l());
}

// ── Operaciones (siempre releen localStorage antes de escribir) ──

export function addProductToStore(product: Product): Product {
  const current = readStorage();

  // Evitar duplicados: si el código ya existe, sumar stock en lugar de duplicar
  const existing = findBarcodeMatch(current, product.barcode);
  const existingIndex = existing ? current.indexOf(existing) : -1;

  if (existingIndex >= 0) {
    const updated = [...current];
    updated[existingIndex] = {
      ...updated[existingIndex],
      stock: updated[existingIndex].stock + product.stock,
      updatedAt: new Date(),
    };
    writeStorage(updated);
    return updated[existingIndex];
  }

  const normalized: Product = {
    ...product,
    barcode: normalizeBarcode(product.barcode),
  };
  writeStorage([...current, normalized]);
  return normalized;
}

export function updateProductInStore(id: string, updates: Partial<Product>) {
  const current = readStorage();
  writeStorage(
    current.map((p) =>
      p.id === id
        ? {
            ...p,
            ...updates,
            ...(updates.barcode ? { barcode: normalizeBarcode(updates.barcode) } : {}),
            updatedAt: new Date(),
          }
        : p
    )
  );
}

export function deleteProductFromStore(id: string) {
  writeStorage(readStorage().filter((p) => p.id !== id));
}

/** Búsqueda por código de barras tolerante a variantes de formato */
export function findByBarcode(code: string): Product | undefined {
  const products = readStorage();
  if (!normalizeBarcode(code)) return undefined;

  // Coincidencia exacta primero; nunca recortar códigos largos ni eliminar símbolos.
  const byBarcode = findBarcodeMatch(products, code);
  if (byBarcode) return byBarcode;

  // 2. Por SKU (etiquetas internas)
  const clean = normalizeBarcode(code).toLowerCase();
  return products.find((p) => (p.sku || "").trim().toLowerCase() === clean);
}
