/**
 * Catálogo de referencia Open Food Facts (México).
 *
 * Este módulo es INTENCIONAMENTE libre de dependencias (sin imports) para que
 * pueda probarse directamente con `node --test` (strip-types) y reutilizarse
 * desde servidor y cliente.
 *
 * Reglas del catálogo OFF:
 *  - Sólo datos de REFERENCIA del producto (código de barras, nombre, marca,
 *    presentación, categoría, foto). NUNCA precios ni existencias: esos son
 *    datos propios de la tienda y se capturan al dar de alta el producto.
 *  - Los productos importados desde OFF nacen INACTIVOS y "pendientes de
 *    precio" (salePrice === 0) hasta que la tienda los da de alta.
 *
 * Licencia de los datos:
 *  - Base de datos: ODbL 1.0 · Contenido: DbCL 1.0 · Fotos: CC BY-SA 3.0
 *    https://world.openfoodfacts.org/terms-of-use
 */

export interface OpenFoodFactsEntry {
  /** Código de barras validado (EAN-8 / UPC-A / EAN-13 / GTIN-14). */
  barcode: string;
  name: string;
  brands?: string;
  quantity?: string;
  category?: string;
  imageUrl?: string;
  offUrl?: string;
}

export interface OpenFoodFactsCounts {
  fetched: number;
  invalid: number;
  duplicates: number;
  imported: number;
}

export interface OpenFoodFactsCatalogFile {
  source: string;
  sourceUrl: string;
  country: string;
  license: string;
  databaseLicense: string;
  photosLicense: string;
  attribution: string;
  importedAt: string | null;
  counts: OpenFoodFactsCounts;
  lastError: string | null;
  products: OpenFoodFactsEntry[];
}

export interface CatalogPage {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: OpenFoodFactsEntry[];
}

/** Dígitos de control estándar GS1 (EAN-8 / UPC-A / EAN-13 / GTIN-14). */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return false;
  const digits = code.split("").reverse().map(Number);
  let sum = 0;
  for (let i = 1; i < digits.length; i++) sum += digits[i] * (i % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === digits[0];
}

/** UPC-A (12 dígitos) ≡ EAN-13 con 0 inicial. Canonicaliza a 13 dígitos. */
export function canonicalBarcode(code: string): string {
  const clean = (code || "").trim();
  if (/^\d{12}$/.test(clean)) return `0${clean}`;
  if (/^\d{14}$/.test(clean)) return clean.slice(1);
  return clean;
}

/**
 * Borrador de producto a partir de una entrada OFF.
 * El precio de venta/compra y el stock NUNCA provienen de OFF:
 * nacen en 0 y la tienda debe capturarlos (producto "pendiente de precio").
 */
export function entryToProductDraft(entry: OpenFoodFactsEntry) {
  return {
    name: entry.name,
    description: [entry.brands, entry.quantity].filter(Boolean).join(" · ") || undefined,
    sku: `OFF-${entry.barcode}`,
    barcode: entry.barcode,
    categoryId: "",
    brand: entry.brands,
    image: entry.imageUrl,
    purchasePrice: 0,
    salePrice: 0,
    stock: 0,
    minStock: 5,
    unit: "pieza",
    tax: 16,
    isActive: false,
  };
}

/** True cuando la entrada aún no tiene precio de venta definido por la tienda. */
export function isPendingPrice(salePrice: number | undefined | null): boolean {
  return !salePrice || salePrice <= 0;
}

export const OPEN_FOOD_FACTS_ATTRIBUTION =
  "Datos de producto © Open Food Facts Contributors — ODbL 1.0 (base de datos), " +
  "DbCL 1.0 (contenido) y CC BY-SA 3.0 (fotografías) · world.openfoodfacts.org";

/**
 * Pagina y filtra en memoria el catálogo (usado por la ruta API para no
 * enviar nunca el JSON completo al cliente).
 */
export function paginateCatalog(
  products: OpenFoodFactsEntry[],
  opts: { page?: number; pageSize?: number; query?: string; barcode?: string }
): CatalogPage {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);
  let filtered = products;

  if (opts.query) {
    const q = opts.query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brands ?? "").toLowerCase().includes(q) ||
          p.barcode.includes(q)
      );
    }
  }
  if (opts.barcode) {
    const key = canonicalBarcode(opts.barcode);
    filtered = filtered.filter((p) => canonicalBarcode(p.barcode) === key);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(opts.page ?? 1, 1), totalPages);
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return { ok: true, total, page, pageSize, totalPages, items };
}
