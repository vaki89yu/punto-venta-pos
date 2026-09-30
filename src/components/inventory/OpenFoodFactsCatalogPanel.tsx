"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useProducts } from "@/hooks/useProducts";
import {
  entryToProductDraft,
  OPEN_FOOD_FACTS_ATTRIBUTION,
  type CatalogPage,
  type OpenFoodFactsCounts,
} from "@/lib/openFoodFactsCatalog";
import { Database, ExternalLink, PackagePlus, Search, RefreshCw, AlertTriangle } from "lucide-react";

interface CatalogResponse extends CatalogPage {
  meta: {
    source: string;
    sourceUrl: string;
    country: string;
    importedAt: string | null;
    counts: OpenFoodFactsCounts;
    lastError: string | null;
    attribution: string;
  };
}

const PAGE_SIZE = 10;

/**
 * Panel del catálogo Open Food Facts (México).
 *
 * - Carga el catálogo PAGINADO desde /api/catalog/openfoodfacts
 *   (el JSON completo nunca viaja al navegador ni toca localStorage).
 * - Cada producto se muestra como referencia: Inactivo · Pendiente de precio.
 * - "Agregar al inventario" crea el producto con precios/stock en 0;
 *   la tienda debe capturarlos (nunca provienen de Open Food Facts).
 */
export function OpenFoodFactsCatalogPanel() {
  const { showToast } = useToast();
  const { products, addProduct } = useProducts();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (targetPage: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/catalog/openfoodfacts?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as CatalogResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, "");
  }, [load]);

  const handleSearch = () => {
    setPage(1);
    load(1, query);
  };

  const handleChangePage = (next: number) => {
    setPage(next);
    load(next, query);
  };

  const handleAdd = (barcode: string, name: string) => {
    const entry = data?.items.find((p) => p.barcode === barcode);
    if (!entry) return;
    if (products.some((p) => p.barcode === entry.barcode)) {
      showToast("Este código de barras ya está en el inventario", "warning");
      return;
    }
    // Precios y stock nacen en 0: la tienda los captura después.
    addProduct(entryToProductDraft(entry));
    showToast(`${name}: agregado como inactivo, pendiente de precio`, "success");
  };

  const meta = data?.meta;
  const isEmptyCatalog = data !== null && data.total === 0;

  return (
    <Card>
      <CardHeader
        title="Catálogo Open Food Facts (México)"
        subtitle="Datos de referencia: código de barras, nombre, marca y foto. Los precios y existencias siempre son propios de la tienda."
        action={
          <Button variant="secondary" size="sm" onClick={() => load(page, query)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        }
      />
      <CardContent className="space-y-4">
        {meta && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={meta.importedAt ? "success" : "warning"}>
              {meta.importedAt
                ? `Importado: ${new Date(meta.importedAt).toLocaleString("es-MX")}`
                : "Catálogo no importado todavía"}
            </Badge>
            <Badge variant="info">{data?.total ?? 0} productos</Badge>
            <Badge variant="secondary">{meta.country}</Badge>
          </div>
        )}

        {meta?.lastError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              El catálogo Open Food Facts todavía está <strong>vacío</strong>: la última importación falló por
              conectividad. No se generaron registros de relleno. Ejecuta{" "}
              <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">npm run catalog:import -- --all</code>{" "}
              desde un entorno con acceso a openfoodfacts.org y vuelve a desplegar.
              <span className="block mt-1 opacity-80">Detalle: {meta.lastError}</span>
            </span>
          </div>
        )}

        {!isEmptyCatalog && (
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, marca o código de barras…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button variant="primary" onClick={handleSearch} disabled={loading}>
              Buscar
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            No se pudo cargar el catálogo: {error}
          </p>
        )}

        {isEmptyCatalog && !meta?.lastError && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            El catálogo Open Food Facts todavía está vacío. Ejecuta{" "}
            <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">npm run catalog:import -- --all</code>{" "}
            en un entorno con acceso a openfoodfacts.org.
          </p>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto mobile-scroll">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Precio</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.items.map((entry) => {
                  const alreadyInStore = products.some((p) => p.barcode === entry.barcode);
                  return (
                    <tr key={entry.barcode}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {entry.imageUrl ? (
                            // Fotos OFF bajo CC BY-SA 3.0
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={entry.imageUrl} alt={entry.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                              OFF
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{entry.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {[entry.brands, entry.quantity].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{entry.barcode}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">Inactivo</Badge>
                          <Badge variant="warning">Pendiente de precio</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">—</td>
                      <td className="px-4 py-3 text-right">
                        {alreadyInStore ? (
                          <Badge variant="success">En inventario</Badge>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => handleAdd(entry.barcode, entry.name)}>
                            <PackagePlus className="w-4 h-4" />
                            Agregar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => handleChangePage(page - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-slate-500">
              Página {data.page} de {data.totalPages}
            </span>
            <Button size="sm" variant="secondary" disabled={page >= data.totalPages || loading} onClick={() => handleChangePage(page + 1)}>
              Siguiente
            </Button>
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          {OPEN_FOOD_FACTS_ATTRIBUTION}
          {meta?.sourceUrl && (
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sky-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
