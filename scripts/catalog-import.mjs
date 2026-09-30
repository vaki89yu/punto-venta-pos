#!/usr/bin/env node
/**
 * Importador del catálogo Open Food Facts (México).
 *
 * Descarga productos REALES desde la API pública de Open Food Facts,
 * valida códigos de barras (dígitos de control GTIN), elimina duplicados
 * y escribe src/data/openFoodFactsMexico.json.
 *
 * IMPORTANTE:
 *  - Este script NUNCA inventa registros: si la red falla, reporta el error
 *    y conserva el archivo previo (o escribe un catálogo vacío con lastError).
 *  - El catálogo OFF sólo contiene datos de referencia del producto
 *    (código de barras, nombre, marca, presentación, categoría, foto).
 *    NUNCA incluye precios ni existencias: eso es dato propio de la tienda.
 *
 * Uso:
 *   npm run catalog:import -- --all
 *   npm run catalog:import -- --all --page-size 100 --max-pages 50
 *   npm run catalog:import -- --query "coca cola"
 *
 * Licencias de los datos importados:
 *  - Base de datos: Open Database License (ODbL) 1.0
 *  - Contenido de la base: Database Contents License (DbCL) 1.0
 *  - Fotografías: Creative Commons Attribution-ShareAlike (CC BY-SA) 3.0
 *   https://world.openfoodfacts.org/terms-of-use
 */

import { readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_OUTPUT = join(ROOT, "src", "data", "openFoodFactsMexico.json");

const OFF_BASE = process.env.OFF_BASE_URL || "https://world.openfoodfacts.org";
const USER_AGENT = "pos-abarrotes-la-esquina/1.0 (catalog import; +https://github.com/vaki89yu/punto-venta-pos)";
const DEFAULT_COUNTRIES_TAG = "mexico";
const MAX_PAGE_SIZE = 600;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 4_000;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { all: false, query: "", countriesTag: DEFAULT_COUNTRIES_TAG, pageSize: 100, maxPages: 500, output: DEFAULT_OUTPUT };
  const hasValueFlag = new Set(["--query", "--countries-tag", "--page-size", "--max-pages", "--output"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i].trim();
    const readValue = (flag) => {
      const eq = arg.indexOf("=");
      if (eq !== -1) return arg.slice(eq + 1).trim();
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        i++;
        return next.trim();
      }
      return "";
    };
    if (arg === "--all") args.all = true;
    else if (arg === "--query" || arg.startsWith("--query=")) args.query = readValue(arg);
    else if (arg === "--countries-tag" || arg.startsWith("--countries-tag=")) args.countriesTag = readValue(arg) || DEFAULT_COUNTRIES_TAG;
    else if (arg === "--page-size" || arg.startsWith("--page-size=")) args.pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(readValue(arg), 10) || 100));
    else if (arg === "--max-pages" || arg.startsWith("--max-pages=")) args.maxPages = Math.max(1, parseInt(readValue(arg), 10) || 500);
    else if (arg === "--output" || arg.startsWith("--output=")) args.output = readValue(arg) || DEFAULT_OUTPUT;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else {
      console.error(`Argumento no reconocido: ${arg}`);
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Uso: npm run catalog:import -- --all [opciones]

Opciones:
  --all                  Importa el catálogo completo del país (requerido para --all).
  --query=<término>      Filtra por término de búsqueda (opcional).
  --countries-tag=<tag>  Tag de país en Open Food Facts (default: ${DEFAULT_COUNTRIES_TAG}).
  --page-size=<n>        Productos por página, 1-${MAX_PAGE_SIZE} (default: 100).
  --max-pages=<n>        Máximo de páginas a descargar (default: 500).
  --output=<ruta>        Archivo de salida (default: src/data/openFoodFactsMexico.json).
`);
}

// ---------------------------------------------------------------------------
// Validación GTIN (EAN-8 / UPC-A / EAN-13 / GTIN-14)
// ---------------------------------------------------------------------------

/** Dígitos de control estándar GS1 sobre la cadena numérica. */
export function isValidGtin(code) {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return false;
  const digits = code.split("").reverse().map(Number);
  let sum = 0;
  for (let i = 1; i < digits.length; i++) sum += digits[i] * (i % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === digits[0];
}

/** UPC-A de 12 dígitos y EAN-13 con 0 inicial son equivalentes: canonical = 13 dígitos. */
export function canonicalBarcode(code) {
  const clean = (code || "").trim();
  if (/^\d{12}$/.test(clean)) return `0${clean}`;
  if (/^\d{14}$/.test(clean)) return clean.slice(1);
  return clean;
}

// ---------------------------------------------------------------------------
// Descarga con reintentos
// ---------------------------------------------------------------------------

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("json")) {
        throw new Error(`Respuesta no-JSON de Open Food Facts (content-type: ${contentType})`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const cause = err?.cause?.code ? ` (${err.cause.code})` : "";
      console.warn(`  Intento ${attempt}/${MAX_RETRIES} falló: ${err.message}${cause}`);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastError;
}

function buildUrl(args, page) {
  const url = new URL("/api/v2/search", OFF_BASE);
  url.searchParams.set("countries_tags", args.countriesTag);
  url.searchParams.set("fields", "code,product_name,product_name_es,generic_name,brands,quantity,categories_tags,image_front_small_url");
  url.searchParams.set("page_size", String(args.pageSize));
  url.searchParams.set("page", String(page));
  if (args.query) url.searchParams.set("query_terms", args.query);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Normalización de entradas
// ---------------------------------------------------------------------------

function readableCategory(categoriesTags) {
  if (!Array.isArray(categoriesTags) || categoriesTags.length === 0) return undefined;
  const last = categoriesTags[categoriesTags.length - 1];
  if (typeof last !== "string") return undefined;
  const label = last.split(":").pop().replace(/-/g, " ").trim();
  return label || undefined;
}

function toEntry(off) {
  const code = (off.code || "").trim();
  if (!isValidGtin(code)) return { ok: false, reason: `código de barras inválido: "${code}"` };

  const name = (off.product_name_es || off.product_name || off.generic_name || "").trim();
  if (!name) return { ok: false, reason: `sin nombre (código ${code})` };

  const brands = (off.brands || "").split(",").map((b) => b.trim()).filter(Boolean).join(", ") || undefined;
  return {
    ok: true,
    entry: {
      barcode: code,
      name,
      brands,
      quantity: (off.quantity || "").trim() || undefined,
      category: readableCategory(off.categories_tags),
      imageUrl: (off.image_front_small_url || "").trim() || undefined,
      offUrl: `https://world.openfoodfacts.org/product/${code}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Escritura atómica del catálogo
// ---------------------------------------------------------------------------

function buildCatalog({ importedAt, counts, lastError, products }) {
  return {
    source: "Open Food Facts",
    sourceUrl: OFF_BASE,
    country: DEFAULT_COUNTRIES_TAG,
    license: "ODbL-1.0",
    databaseLicense: "DbCL-1.0",
    photosLicense: "CC BY-SA 3.0",
    attribution:
      "Datos de producto © Open Food Facts Contributors, licenciados bajo Open Database License (ODbL) 1.0. " +
      "Contenido de la base de datos bajo Database Contents License (DbCL) 1.0. " +
      "Fotografías bajo Creative Commons Attribution-ShareAlike (CC BY-SA) 3.0. https://world.openfoodfacts.org/terms-of-use",
    importedAt,
    counts,
    lastError,
    products,
  };
}

function writeAtomic(outputPath, catalog) {
  const tmp = `${outputPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  renameSync(tmp, outputPath);
}

function emptyCatalog(lastError) {
  return buildCatalog({
    importedAt: null,
    counts: { fetched: 0, invalid: 0, duplicates: 0, imported: 0 },
    lastError: lastError ?? null,
    products: [],
  });
}

function existingCatalogHasProducts(outputPath) {
  try {
    if (statSync(outputPath).size === 0) return false;
    const parsed = JSON.parse(readFileSync(outputPath, "utf8"));
    return Array.isArray(parsed.products) && parsed.products.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.all) {
    printHelp();
    process.exit(args.help && args.all ? 0 : 1);
  }

  console.log(`Catálogo Open Food Facts — país: "${args.countriesTag}"${args.query ? `, búsqueda: "${args.query}"` : " (completo)"}`);
  console.log(`Fuente: ${OFF_BASE}`);

  const counts = { fetched: 0, invalid: 0, duplicates: 0, imported: 0 };
  const byCanonical = new Map();

  try {
    for (let page = 1; page <= args.maxPages; page++) {
      const url = buildUrl(args, page);
      process.stdout.write(`Página ${page}… `);
      const payload = await fetchJson(url);
      const items = Array.isArray(payload?.products) ? payload.products : [];
      if (items.length === 0) {
        if (page === 1) console.log("sin resultados.");
        else console.log("fin del catálogo.");
        break;
      }
      counts.fetched += items.length;
      let pageValid = 0;
      for (const off of items) {
        const { ok, entry, reason } = toEntry(off);
        if (!ok) {
          counts.invalid++;
          continue;
        }
        const key = canonicalBarcode(entry.barcode);
        if (byCanonical.has(key)) {
          counts.duplicates++;
          continue;
        }
        byCanonical.set(key, entry);
        pageValid++;
      }
      counts.imported += pageValid;
      console.log(`${items.length} descargados, ${pageValid} válidos nuevos (${counts.duplicates} duplicados acumulados).`);
      if (items.length < args.pageSize) {
        console.log("Última página alcanzada.");
        break;
      }
    }

    if (counts.imported === 0) {
      throw new Error(
        "Open Food Facts no devolvió productos válidos para este filtro (0 importados). Revisa conectividad o parámetros."
      );
    }

    const products = [...byCanonical.values()].sort((a, b) => canonicalBarcode(a.barcode).localeCompare(canonicalBarcode(b.barcode)));
    const catalog = buildCatalog({
      importedAt: new Date().toISOString(),
      counts: { ...counts, imported: products.length },
      lastError: null,
      products,
    });
    writeAtomic(args.output, catalog);
    const sizeKb = Math.round(statSync(args.output).size / 1024);
    console.log(`\n✅ ${products.length} productos válidos importados (${counts.duplicates} duplicados omitidos, ${counts.invalid} inválidos).`);
    console.log(`   Archivo: ${args.output} (${sizeKb} KB)`);
    process.exit(0);
  } catch (err) {
    const message = `Fallo de importación (${new Date().toISOString()}): ${err.message}`;
    console.error(`\n❌ ${message}`);
    if (existingCatalogHasProducts(args.output)) {
      console.error(`Se conserva el catálogo previo en ${args.output} (no se sobreescribe con datos vacíos).`);
    } else {
      const catalog = emptyCatalog(message);
      writeAtomic(args.output, catalog);
      console.error(`Catálogo escrito vacío con el error registrado en "lastError": ${args.output}`);
      console.error("NO se inventaron registros. Vuelve a ejecutar la importación con acceso a Open Food Facts.");
    }
    process.exit(1);
  }
}

main();
