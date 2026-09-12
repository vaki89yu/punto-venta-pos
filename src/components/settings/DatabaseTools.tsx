"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/components/ui/Toast";
import { normalizeBarcode } from "@/lib/productStore";
import { STORAGE_KEYS } from "@/data/seed";
import { Database, Search, Wrench, CheckCircle2, AlertTriangle } from "lucide-react";
import { Product } from "@/types";

export function DatabaseTools() {
  const { products, getProductByBarcode, refreshProducts } = useProducts();
  const { showToast } = useToast();
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<Product | null | "notfound">(null);

  // Diagnóstico
  const duplicates = React.useMemo(() => {
    const seen = new Map<string, number>();
    products.forEach((p) => {
      const k = normalizeBarcode(p.barcode);
      seen.set(k, (seen.get(k) || 0) + 1);
    });
    return [...seen.entries()].filter(([, n]) => n > 1);
  }, [products]);

  const needsNormalize = products.filter(
    (p) => p.barcode !== normalizeBarcode(p.barcode)
  );

  const noBarcode = products.filter((p) => !p.barcode?.trim());

  const handleTest = () => {
    if (!testCode.trim()) return;
    const found = getProductByBarcode(testCode.trim());
    setTestResult(found || "notfound");
  };

  const handleRepair = () => {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) return;

    const list: Product[] = JSON.parse(raw);
    const merged = new Map<string, Product>();

    list.forEach((p) => {
      const key = normalizeBarcode(p.barcode) || p.id;
      const existing = merged.get(key);
      if (existing) {
        // Fusionar duplicados sumando stock
        merged.set(key, { ...existing, stock: existing.stock + p.stock });
      } else {
        merged.set(key, { ...p, barcode: normalizeBarcode(p.barcode) });
      }
    });

    const cleaned = [...merged.values()];
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleaned));
    refreshProducts();

    const removed = list.length - cleaned.length;
    showToast(
      removed > 0
        ? `Reparado: ${removed} duplicado(s) fusionado(s)`
        : "Base de datos correcta, códigos normalizados",
      "success"
    );
  };

  const isHealthy = duplicates.length === 0 && needsNormalize.length === 0;

  return (
    <Card>
      <CardHeader
        title="Diagnóstico de Inventario"
        subtitle="Verifica y repara los datos de productos"
      />
      <CardContent className="space-y-4">
        {/* Estado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl text-center">
            <Database className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-slate-800">{products.length}</p>
            <p className="text-xs text-slate-500">Productos</p>
          </div>
          <div
            className={`p-3 rounded-xl text-center ${
              duplicates.length ? "bg-red-50" : "bg-emerald-50"
            }`}
          >
            <p
              className={`text-xl font-bold ${
                duplicates.length ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {duplicates.length}
            </p>
            <p className="text-xs text-slate-500">Duplicados</p>
          </div>
          <div
            className={`p-3 rounded-xl text-center ${
              needsNormalize.length ? "bg-amber-50" : "bg-emerald-50"
            }`}
          >
            <p
              className={`text-xl font-bold ${
                needsNormalize.length ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {needsNormalize.length}
            </p>
            <p className="text-xs text-slate-500">Sin normalizar</p>
          </div>
          <div
            className={`p-3 rounded-xl text-center ${
              noBarcode.length ? "bg-amber-50" : "bg-emerald-50"
            }`}
          >
            <p
              className={`text-xl font-bold ${
                noBarcode.length ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {noBarcode.length}
            </p>
            <p className="text-xs text-slate-500">Sin código</p>
          </div>
        </div>

        {/* Estado general */}
        <div
          className={`flex items-center gap-3 p-3 rounded-xl border ${
            isHealthy
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          {isHealthy ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          )}
          <p
            className={`text-sm font-medium ${
              isHealthy ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {isHealthy
              ? "Todo correcto. Los códigos se detectan bien al escanear."
              : "Se detectaron inconsistencias. Usa Reparar para corregirlas."}
          </p>
        </div>

        {/* Probar código */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Probar detección de un código
          </label>
          <div className="flex gap-2">
            <input
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
              placeholder="Escribe o escanea un código..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900"
            />
            <Button onClick={handleTest} leftIcon={<Search className="w-4 h-4" />}>
              Probar
            </Button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-xl border ${
                testResult === "notfound"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              {testResult === "notfound" ? (
                <p className="text-sm text-blue-700">
                  <b>No registrado.</b> Al escanearlo se abrirá el formulario de alta.
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-800 truncate">
                      {testResult.name}
                    </p>
                    <p className="text-xs text-emerald-600">
                      Stock: {testResult.stock} · SKU: {testResult.sku}
                    </p>
                  </div>
                  <Badge variant="success">Va al carrito</Badge>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reparar */}
        <div className="pt-2 border-t border-slate-100">
          <Button
            variant={isHealthy ? "secondary" : "warning"}
            onClick={handleRepair}
            leftIcon={<Wrench className="w-4 h-4" />}
            fullWidth
          >
            Reparar y normalizar inventario
          </Button>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Fusiona duplicados sumando su stock y limpia espacios en los códigos
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
