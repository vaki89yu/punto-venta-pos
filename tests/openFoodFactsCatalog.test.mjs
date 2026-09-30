/**
 * Pruebas del catálogo Open Food Facts (México).
 *
 * Invariantes que el proyecto garantiza:
 *  1. Sólo datos de referencia (NUNCA precios ni existencias desde OFF).
 *  2. Códigos de barras válidos (dígitos de control GTIN) y sin duplicados.
 *  3. Los borradores generados nacen inactivos y pendientes de precio.
 *  4. Atribución ODbL / DbCL / CC BY-SA presente en el catálogo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  entryToProductDraft,
  isValidGtin,
  canonicalBarcode,
  paginateCatalog,
  OPEN_FOOD_FACTS_ATTRIBUTION,
} from "../src/lib/openFoodFactsCatalog.ts";

const catalogPath = new URL("../src/data/openFoodFactsMexico.json", import.meta.url);
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

test("el catálogo OFF tiene metadatos de fuente y licencias ODbL/DbCL/CC BY-SA", () => {
  assert.equal(catalog.source, "Open Food Facts");
  assert.equal(catalog.license, "ODbL-1.0");
  assert.equal(catalog.databaseLicense, "DbCL-1.0");
  assert.equal(catalog.photosLicense, "CC BY-SA 3.0");
  assert.match(catalog.attribution, /ODbL/);
  assert.match(catalog.attribution, /DbCL/);
  assert.match(catalog.attribution, /CC BY-SA/);
  assert.match(OPEN_FOOD_FACTS_ATTRIBUTION, /ODbL/);
});

test("counts refleja el tamaño real del catálogo", () => {
  assert.equal(typeof catalog.counts.imported, "number");
  assert.equal(catalog.products.length, catalog.counts.imported);
});

test("cada entrada tiene código de barras GTIN válido y nombre", () => {
  for (const entry of catalog.products) {
    assert.ok(isValidGtin(entry.barcode), `barcode inválido: ${entry.barcode}`);
    assert.ok(typeof entry.name === "string" && entry.name.trim().length > 0, `sin nombre: ${entry.barcode}`);
    if (entry.offUrl) assert.ok(entry.offUrl.endsWith(entry.barcode));
  }
});

test("no hay duplicados por código de barras (UPC-A ≡ EAN-13 con 0 inicial)", () => {
  const seen = new Set();
  for (const entry of catalog.products) {
    const key = canonicalBarcode(entry.barcode);
    assert.ok(!seen.has(key), `duplicado: ${entry.barcode}`);
    seen.add(key);
  }
});

test("las entradas OFF NUNCA traen precios ni existencias (datos propios de la tienda)", () => {
  const forbidden = ["purchasePrice", "salePrice", "discountPrice", "stock", "minStock", "price", "cost"];
  for (const entry of catalog.products) {
    for (const key of forbidden) {
      assert.ok(!(key in entry), `entrada OFF con campo prohibido "${key}": ${entry.barcode}`);
    }
  }
});

test("el borrador desde OFF nace inactivo y pendiente de precio (precios/stock en 0)", () => {
  const entry = { barcode: "7501055300077", name: "Coca-Cola 600ml", brands: "Coca-Cola", quantity: "600 ml" };
  const draft = entryToProductDraft(entry);
  assert.equal(draft.isActive, false);
  assert.equal(draft.salePrice, 0);
  assert.equal(draft.purchasePrice, 0);
  assert.equal(draft.stock, 0);
  assert.equal(draft.barcode, "7501055300077");
  assert.equal(draft.sku, "OFF-7501055300077");
});

test("isValidGtin valida dígitos de control GS1", () => {
  assert.equal(isValidGtin("4006381333931"), true); // EAN-13 válido
  assert.equal(isValidGtin("036000291452"), true); // UPC-A válido
  assert.equal(isValidGtin("4006381333932"), false); // dígito incorrecto
  assert.equal(isValidGtin("123"), false); // longitud inválida
  assert.equal(isValidGtin("400638133393X"), false); // no numérico
});

test("canonicalBarcode unifica UPC-A, EAN-13 y GTIN-14", () => {
  assert.equal(canonicalBarcode("036000291452"), "0036000291452");
  assert.equal(canonicalBarcode("7501055300077"), "7501055300077");
  assert.equal(canonicalBarcode("14006381333931"), "4006381333931"); // GTIN-14 → EAN-13
});

test("paginateCatalog filtra por texto y pagina sin exceder límites", () => {
  const products = [
    { barcode: "7501055300077", name: "Coca-Cola 600ml", brands: "Coca-Cola" },
    { barcode: "7501055300084", name: "Coca-Cola 2.5L", brands: "Coca-Cola" },
    { barcode: "7501000101501", name: "Sabritas Original", brands: "Sabritas" },
  ];
  const all = paginateCatalog(products, {});
  assert.equal(all.total, 3);
  assert.equal(all.totalPages, 1);

  const filtered = paginateCatalog(products, { query: "coca" });
  assert.equal(filtered.total, 2);

  const byBarcode = paginateCatalog(products, { barcode: "036000291452" });
  assert.equal(byBarcode.total, 0);

  const paged = paginateCatalog(products, { page: 2, pageSize: 2 });
  assert.equal(paged.items.length, 1);
  assert.equal(paged.page, 2);
  assert.equal(paged.totalPages, 2);

  const clamped = paginateCatalog(products, { page: 99, pageSize: 2 });
  assert.equal(clamped.page, clamped.totalPages);
  assert.equal(clamped.items.length, 1);
});
