import catalogJson from "@/data/openFoodFactsMexico.json";
import {
  paginateCatalog,
  OPEN_FOOD_FACTS_ATTRIBUTION,
  type OpenFoodFactsCatalogFile,
} from "@/lib/openFoodFactsCatalog";

/**
 * Ruta paginada para el catálogo Open Food Facts.
 *
 * El JSON completo vive SÓLO en el servidor: el cliente nunca lo descarga
 * entero (evita inflar el bundle de Next.js ni gastar localStorage).
 * Uso: /api/catalog/openfoodfacts?page=1&pageSize=20&q=coca
 *      /api/catalog/openfoodfacts?barcode=7501055300077
 */

export const dynamic = "force-dynamic";

// El cast evita que TypeScript inferifique tipos literales para archivos enormes.
const catalog = catalogJson as unknown as OpenFoodFactsCatalogFile;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10) || 20;
  const query = searchParams.get("q") ?? undefined;
  const barcode = searchParams.get("barcode") ?? undefined;

  const result = paginateCatalog(catalog.products ?? [], { page, pageSize, query, barcode });

  return Response.json({
    ...result,
    meta: {
      source: catalog.source,
      sourceUrl: catalog.sourceUrl,
      country: catalog.country,
      importedAt: catalog.importedAt,
      counts: catalog.counts,
      lastError: catalog.lastError,
      attribution: OPEN_FOOD_FACTS_ATTRIBUTION,
    },
  });
}
