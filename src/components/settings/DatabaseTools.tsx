"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/components/ui/Toast";
import { normalizeBarcode } from "@/lib/productStore";
import { Database, Search, RefreshCw, CheckCircle2, AlertTriangle, CloudOff } from "lucide-react";
import { Product } from "@/types";

type Health = { ok: boolean; database: string; message: string };
export function DatabaseTools() {
  const { products, getProductByBarcode, refreshProducts } = useProducts();
  const { showToast } = useToast();
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<Product | null | "notfound">(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/health", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as Health | null;
        if (active && result) setHealth(result);
      })
      .catch(() => { if (active) setHealth({ ok: false, database: "unreachable", message: "No se pudo verificar PostgreSQL." }); });
    return () => { active = false; };
  }, []);

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const product of products) {
      const barcode = normalizeBarcode(product.barcode);
      if (barcode) seen.set(barcode, (seen.get(barcode) || 0) + 1);
    }
    return [...seen.entries()].filter(([, count]) => count > 1);
  }, [products]);
  const needsNormalize = products.filter((product) => product.barcode !== normalizeBarcode(product.barcode));
  const noBarcode = products.filter((product) => !product.barcode?.trim());
  const isHealthy = Boolean(health?.ok) && duplicates.length === 0 && needsNormalize.length === 0 && noBarcode.length === 0;

  const handleTest = () => {
    if (!testCode.trim()) return;
    setTestResult(getProductByBarcode(testCode.trim()) || "notfound");
  };
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await refreshProducts();
      const response = await fetch("/api/health", { cache: "no-store" });
      setHealth(await response.json() as Health);
      showToast("Catálogo actualizado desde PostgreSQL", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo actualizar el catálogo.", "error"); }
    finally { setRefreshing(false); }
  };

  return (
    <Card>
      <CardHeader title="Diagnóstico del servidor" subtitle="El catálogo de esta pantalla proviene de PostgreSQL; no se repara ni escribe en el navegador." />
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center"><Database className="mx-auto mb-1 h-5 w-5 text-slate-500" /><p className="text-xl font-bold text-slate-800">{products.length}</p><p className="text-xs text-slate-500">Productos en servidor</p></div>
          <div className={`rounded-xl p-3 text-center ${duplicates.length ? "bg-red-50" : "bg-emerald-50"}`}><p className={`text-xl font-bold ${duplicates.length ? "text-red-600" : "text-emerald-600"}`}>{duplicates.length}</p><p className="text-xs text-slate-500">Códigos duplicados</p></div>
          <div className={`rounded-xl p-3 text-center ${needsNormalize.length ? "bg-amber-50" : "bg-emerald-50"}`}><p className={`text-xl font-bold ${needsNormalize.length ? "text-amber-600" : "text-emerald-600"}`}>{needsNormalize.length}</p><p className="text-xs text-slate-500">Códigos sin normalizar</p></div>
          <div className={`rounded-xl p-3 text-center ${noBarcode.length ? "bg-amber-50" : "bg-emerald-50"}`}><p className={`text-xl font-bold ${noBarcode.length ? "text-amber-600" : "text-emerald-600"}`}>{noBarcode.length}</p><p className="text-xs text-slate-500">Sin código</p></div>
        </div>

        <div className={`flex items-start gap-3 rounded-xl border p-3 ${isHealthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          {health?.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
          <div className="flex-1"><p className="text-sm font-semibold">{health?.ok ? "PostgreSQL conectado" : "Servidor no listo"}</p><p className="text-sm">{health?.message || "Verificando conexión…"}</p></div>
          <Badge variant={health?.ok ? "success" : "warning"}>{health?.database || "verificando"}</Badge>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Buscar un código en el catálogo del servidor</label>
          <div className="flex gap-2"><input value={testCode} onChange={(event) => setTestCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleTest()} placeholder="Escribe o escanea un código…" className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900" /><Button onClick={handleTest} leftIcon={<Search className="h-4 w-4" />}>Buscar</Button></div>
          {testResult && <div className="mt-3 rounded-xl border border-slate-200 p-3">{testResult === "notfound" ? <p className="text-sm">Ese código no está en el catálogo propio.</p> : <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{testResult.name}</p><p className="text-xs text-slate-500">Existencia: {testResult.stock} · SKU: {testResult.sku}</p></div><Badge variant="success">Encontrado</Badge></div>}</div>}
        </div>

        <Button variant="secondary" onClick={refreshData} isLoading={refreshing} disabled={refreshing} leftIcon={<RefreshCw className="h-4 w-4" />} fullWidth>Actualizar desde PostgreSQL</Button>
        {duplicates.length > 0 && <p className="flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="h-4 w-4" />No combines existencias automáticamente. Corrige códigos duplicados y documenta cualquier ajuste desde Inventario.</p>}
      </CardContent>
    </Card>
  );
}
