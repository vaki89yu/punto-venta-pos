"use client";

import React, { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { Customer, Product, Sale, StoreSettings, Supplier } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  addInventoryLot,
  AuditEvent,
  calculateReplenishmentRecommendations,
  createInvoiceRequest,
  FEATURE_STORAGE_KEYS,
  getGrossMarginPercent,
  getTrackedLotQuantity,
  InventoryLot,
  InvoiceRequest,
  isFractionalUnit,
  isValidMexicanRFC,
  recordAuditEvent,
} from "@/lib/professionalFeatures";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CloudOff,
  FileCheck2,
  FileText,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wifi,
} from "lucide-react";

type OperationsTab = "overview" | "lots" | "replenishment" | "audit" | "invoices" | "integrations";

const fiscalRegimes = [
  ["601", "601 · General de Ley Personas Morales"],
  ["603", "603 · Personas Morales sin Fines de Lucro"],
  ["605", "605 · Sueldos y Salarios"],
  ["612", "612 · Actividades Empresariales y Profesionales"],
  ["616", "616 · Sin obligaciones fiscales"],
  ["626", "626 · Régimen Simplificado de Confianza"],
];
const cfdiUses = [
  ["G03", "G03 · Gastos en general"],
  ["S01", "S01 · Sin efectos fiscales"],
  ["D01", "D01 · Honorarios médicos"],
  ["CP01", "CP01 · Pagos"],
];
const operationKeys = [
  FEATURE_STORAGE_KEYS.LOTS,
  FEATURE_STORAGE_KEYS.AUDIT,
  FEATURE_STORAGE_KEYS.INVOICE_REQUESTS,
  STORAGE_KEYS.SUPPLIERS,
  STORAGE_KEYS.CUSTOMERS,
  STORAGE_KEYS.SETTINGS,
] as const;

function subscribeOperationalStorage(callback: () => void) {
  const keys = new Set<string>(operationKeys);
  const onStorage = (event: StorageEvent) => { if (!event.key || keys.has(event.key)) callback(); };
  const onLocalChange = (event: Event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key;
    if (!key || keys.has(key)) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pos:local-change", onLocalChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pos:local-change", onLocalChange);
  };
}

function getOperationalSnapshot() {
  return JSON.stringify(operationKeys.map((key) => localStorage.getItem(key) || (key === STORAGE_KEYS.SETTINGS ? "{}" : "[]")));
}
function getOperationalServerSnapshot() { return "[]"; }
function subscribeNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function getNetworkSnapshot() { return navigator.onLine; }
function getNetworkServerSnapshot() { return true; }
function parseJson<T>(value: string | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function getLotState(lot: InventoryLot, now = new Date()) {
  if (lot.quantity <= 0) return { label: "Agotado", tone: "secondary" as const, days: null as number | null };
  if (!lot.expiresOn) return { label: "Sin fecha", tone: "secondary" as const, days: null as number | null };
  const expiry = new Date(`${lot.expiresOn}T23:59:59`);
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { label: "Vencido", tone: "danger" as const, days };
  if (days <= 7) return { label: "Vence pronto", tone: "danger" as const, days };
  if (days <= 30) return { label: "Próximo", tone: "warning" as const, days };
  return { label: "Vigente", tone: "success" as const, days };
}

function getSaleCustomer(sale: Sale, customers: Customer[]) {
  return sale.customer || customers.find((customer) => customer.id === sale.customerId);
}

function OperationsContent() {
  const { showToast } = useToast();
  const { user, hasPermission } = useAuth();
  const { products, updateProduct } = useProducts();
  const { sales } = useSales();
  const { orders, createOrder } = usePurchaseOrders();
  const snapshot = useSyncExternalStore(subscribeOperationalStorage, getOperationalSnapshot, getOperationalServerSnapshot);
  const online = useSyncExternalStore(subscribeNetwork, getNetworkSnapshot, getNetworkServerSnapshot);
  const parsedSnapshot = useMemo(() => parseJson<string[]>(snapshot, []), [snapshot]);
  const lots = useMemo(() => parseJson<InventoryLot[]>(parsedSnapshot[0], []), [parsedSnapshot]);
  const auditEvents = useMemo(() => parseJson<AuditEvent[]>(parsedSnapshot[1], []), [parsedSnapshot]);
  const invoiceRequests = useMemo(() => parseJson<InvoiceRequest[]>(parsedSnapshot[2], []), [parsedSnapshot]);
  const suppliers = useMemo(() => parseJson<Supplier[]>(parsedSnapshot[3], []), [parsedSnapshot]);
  const customers = useMemo(() => parseJson<Customer[]>(parsedSnapshot[4], []), [parsedSnapshot]);
  const settings = useMemo(() => parseJson<StoreSettings | null>(parsedSnapshot[5], null), [parsedSnapshot]);

  const [activeTab, setActiveTab] = useState<OperationsTab>("overview");
  const [showLotModal, setShowLotModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [lotError, setLotError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [lotForm, setLotForm] = useState({ productId: "", lotCode: "", quantity: "", expiresOn: "", unitCost: "", addToStock: true });
  const [invoiceForm, setInvoiceForm] = useState({ saleId: "", rfc: "", legalName: "", postalCode: "", fiscalRegime: "", cfdiUse: "G03", email: "" });
  const [coverageOverride, setCoverageOverride] = useState<number | null>(null);
  const [leadOverride, setLeadOverride] = useState<number | null>(null);
  const [supplierSelections, setSupplierSelections] = useState<Record<string, string>>({});

  const coverageDays = coverageOverride ?? Math.max(1, Number(settings?.defaultCoverageDays) || 14);
  const leadTimeDays = leadOverride ?? Math.max(0, Number(settings?.defaultLeadTimeDays) || 7);
  const marginFloor = Math.max(0, Math.min(90, Number(settings?.minimumGrossMarginPercent ?? 10) || 0));
  const isManager = user?.role === "admin" || user?.role === "manager";
  const canViewOperations = hasPermission("operations");

  const recommendations = useMemo(() => calculateReplenishmentRecommendations(
    products.filter((product) => product.isActive).map((product) => ({
      id: product.id, name: product.name, unit: product.unit, stock: product.stock,
      minStock: product.minStock, purchasePrice: product.purchasePrice, supplierId: product.supplierId,
    })),
    sales.map((sale) => ({ status: sale.status, createdAt: sale.createdAt, items: sale.items })),
    orders.map((order) => ({ status: order.status, items: order.items })),
    { daysToAnalyze: 30, coverageDays, leadTimeDays }
  ), [products, sales, orders, coverageDays, leadTimeDays]);

  const lotWarnings = useMemo(() => lots.filter((lot) => {
    const state = getLotState(lot);
    return lot.quantity > 0 && ["Vencido", "Vence pronto", "Próximo"].includes(state.label);
  }), [lots]);
  const marginWarnings = useMemo(() => products.filter((product) => product.isActive && getGrossMarginPercent(product.purchasePrice, product.salePrice) < marginFloor), [products, marginFloor]);
  const requestedSaleIds = useMemo(() => new Set(invoiceRequests.map((request) => request.saleId)), [invoiceRequests]);
  const invoiceEligibleSales = useMemo(() => sales.filter((sale) => sale.status === "completed" && !requestedSaleIds.has(sale.id)), [sales, requestedSaleIds]);

  const openLotModal = () => {
    setLotForm({ productId: "", lotCode: "", quantity: "", expiresOn: "", unitCost: "", addToStock: true });
    setLotError("");
    setShowLotModal(true);
  };

  const submitLot = (event: FormEvent) => {
    event.preventDefault();
    setLotError("");
    const product = products.find((item) => item.id === lotForm.productId);
    const quantity = Number(lotForm.quantity);
    const unitCost = Number(lotForm.unitCost);
    if (!product) return setLotError("Selecciona un producto válido.");
    if (!lotForm.lotCode.trim()) return setLotError("El lote necesita un folio identificador.");
    if (!Number.isFinite(quantity) || quantity <= 0) return setLotError("La cantidad debe ser mayor a cero.");
    if (!lotForm.expiresOn || Number.isNaN(new Date(`${lotForm.expiresOn}T00:00:00`).getTime())) return setLotError("Captura una fecha de vencimiento válida.");
    if (!Number.isFinite(unitCost) || unitCost < 0) return setLotError("El costo unitario debe ser cero o mayor.");
    if (lots.some((lot) => lot.productId === product.id && lot.lotCode.trim().toLowerCase() === lotForm.lotCode.trim().toLowerCase())) return setLotError("Ya existe ese número de lote para este producto.");
    const tracked = getTrackedLotQuantity(product.id, lots);
    if (!lotForm.addToStock && quantity > Math.max(0, product.stock - tracked) + 0.0001) return setLotError(`Solo puedes vincular ${Math.max(0, product.stock - tracked)} ${product.unit} del inventario actual.`);
    if (lotForm.addToStock && new Date(`${lotForm.expiresOn}T23:59:59`).getTime() < new Date().getTime()) return setLotError("No se puede recibir como mercancía nueva un lote vencido.");

    const lot = addInventoryLot({
      productId: product.id, productName: product.name, lotCode: lotForm.lotCode.trim(),
      quantity, receivedQuantity: quantity, expiresOn: lotForm.expiresOn, unitCost,
      receivedBy: user?.name || "Usuario", source: lotForm.addToStock ? "purchase" : "opening",
    });
    if (lotForm.addToStock) updateProduct(product.id, { stock: product.stock + quantity });
    recordAuditEvent({
      action: "inventory.lot.created", entityType: "inventory_lot", entityId: lot.id,
      summary: `Lote ${lot.lotCode} registrado para ${product.name}; vence ${lot.expiresOn}.`,
      metadata: { productId: product.id, quantity, expiresOn: lot.expiresOn, addedToStock: lotForm.addToStock },
    });
    setShowLotModal(false);
    showToast("Lote registrado; se aplicará FEFO en las siguientes ventas", "success");
  };

  const submitInvoiceRequest = (event: FormEvent) => {
    event.preventDefault();
    setInvoiceError("");
    const sale = sales.find((item) => item.id === invoiceForm.saleId);
    if (!sale) return setInvoiceError("Selecciona un ticket completado.");
    try {
      createInvoiceRequest({
        saleId: sale.id, ticketNumber: sale.ticketNumber, rfc: invoiceForm.rfc,
        legalName: invoiceForm.legalName, postalCode: invoiceForm.postalCode,
        fiscalRegime: invoiceForm.fiscalRegime, cfdiUse: invoiceForm.cfdiUse, email: invoiceForm.email,
      });
      setShowInvoiceModal(false);
      setInvoiceForm({ saleId: "", rfc: "", legalName: "", postalCode: "", fiscalRegime: "", cfdiUse: "G03", email: "" });
      showToast("Solicitud registrada en este dispositivo; aún no se ha emitido un CFDI.", "success");
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
    }
  };

  const saveForecastSettings = () => {
    const nextSettings: StoreSettings = {
      ...(settings || { id: "settings-1", name: "Mi Tienda", taxRate: 16, currency: "MXN", theme: "system" }),
      defaultCoverageDays: Math.max(1, Math.floor(coverageDays)),
      defaultLeadTimeDays: Math.max(0, Math.floor(leadTimeDays)),
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(nextSettings));
    window.dispatchEvent(new CustomEvent("pos:local-change", { detail: { key: STORAGE_KEYS.SETTINGS } }));
    setCoverageOverride(null);
    setLeadOverride(null);
    showToast("Parámetros de reposición guardados", "success");
  };

  const createSuggestedOrder = (recommendation: (typeof recommendations)[number]) => {
    const supplierId = supplierSelections[recommendation.productId] || recommendation.supplierId || "";
    const supplier = suppliers.find((item) => item.id === supplierId);
    const product = products.find((item) => item.id === recommendation.productId);
    if (!supplier || !product) return showToast("Asigna un proveedor para generar la orden", "warning");
    createOrder({
      supplierId: supplier.id, supplierName: supplier.name,
      items: [{ productId: product.id, productName: product.name, quantity: recommendation.recommendedQuantity, unitCost: product.purchasePrice, total: recommendation.estimatedCost }],
      total: recommendation.estimatedCost,
      expectedDate: new Date(new Date().getTime() + leadTimeDays * 86_400_000),
      notes: `Sugerencia basada en ventas de 30 días, ${coverageDays} días de cobertura y ${leadTimeDays} días de entrega. Revisar antes de enviar al proveedor.`,
    });
    showToast(`Borrador de compra creado para ${supplier.name}`, "success");
  };

  const openInvoiceModal = (sale?: Sale) => {
    const customer = sale ? getSaleCustomer(sale, customers) : undefined;
    setInvoiceForm({
      saleId: sale?.id || "", rfc: customer?.rfc || "", legalName: customer?.name || "",
      postalCode: "", fiscalRegime: "", cfdiUse: "G03", email: customer?.email || "",
    });
    setInvoiceError("");
    setShowInvoiceModal(true);
  };

  if (!canViewOperations) {
    return <ProtectedLayout><Card><CardContent className="p-10 text-center"><ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" /><h2 className="text-lg font-bold">Acceso restringido</h2><p className="mt-1 text-sm text-slate-500">Tu usuario no tiene permiso para abrir el centro de operaciones.</p></CardContent></Card></ProtectedLayout>;
  }

  const tabs: { id: OperationsTab; label: string; icon: React.ElementType; visible: boolean }[] = [
    { id: "overview", label: "Radar", icon: Sparkles, visible: true },
    { id: "lots", label: "Lotes y caducidad", icon: CalendarClock, visible: true },
    { id: "replenishment", label: "Reposición", icon: ArrowDownToLine, visible: true },
    { id: "audit", label: "Auditoría", icon: ClipboardCheck, visible: isManager },
    { id: "invoices", label: "Solicitudes CFDI", icon: FileCheck2, visible: isManager },
    { id: "integrations", label: "Conectores", icon: RefreshCw, visible: isManager },
  ];

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-100"><Sparkles className="h-3.5 w-3.5" /> CONTROL OPERATIVO PROFESIONAL</div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Radar de la tienda</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Detecta mermas, faltantes y riesgos de margen; convierte cada señal en una acción revisable, con historial de operación.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={openLotModal} leftIcon={<Plus className="h-4 w-4" />}>Registrar lote</Button>{isManager && <Button onClick={() => openInvoiceModal()} leftIcon={<FileText className="h-4 w-4" />}>Solicitud de factura</Button>}</div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <RadarMetric icon={<CalendarClock className="h-4 w-4" />} label="Lotes por revisar" value={String(lotWarnings.length)} hint="Vencidos o próximos" />
            <RadarMetric icon={<Package className="h-4 w-4" />} label="Reposición sugerida" value={String(recommendations.length)} hint="Órdenes pendientes descontadas" />
            <RadarMetric icon={<CircleDollarSign className="h-4 w-4" />} label="Alertas de margen" value={String(marginWarnings.length)} hint={`Mínimo: ${marginFloor}%`} />
            <RadarMetric icon={<Activity className="h-4 w-4" />} label="Eventos auditados" value={String(auditEvents.length)} hint="Bitácora local reciente" />
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {tabs.filter((tab) => tab.visible).map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}
        </div>

        {activeTab === "overview" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <Card><CardHeader title="Acciones recomendadas" subtitle="El sistema explica la señal; el encargado decide si ejecutarla." /><CardContent className="space-y-3">
              {recommendations.slice(0, 4).map((item) => <div key={item.productId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-700"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.priority === "critical" ? "bg-red-100 text-red-700 dark:bg-red-950" : "bg-amber-100 text-amber-700 dark:bg-amber-950"}`}><Package className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900 dark:text-white">{item.productName}</p><Badge variant={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "info"}>{item.priority === "critical" ? "Urgente" : item.priority === "high" ? "Prioridad alta" : "Reposición"}</Badge></div><p className="mt-1 text-sm text-slate-500">Stock {item.stock} {item.unit}{item.daysOfCover === null ? " · Sin historial de ventas suficiente" : ` · ${item.daysOfCover} días de cobertura`}. Sugerencia: {item.recommendedQuantity} {item.unit}.</p></div><Button size="sm" variant="secondary" onClick={() => setActiveTab("replenishment")}>Revisar</Button></div>)}
              {lotWarnings.slice(0, 3).map((lot) => { const state = getLotState(lot); return <div key={lot.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900 dark:text-white">{lot.productName} · Lote {lot.lotCode}</p><p className="text-sm text-slate-600 dark:text-slate-300">{state.label}{state.days !== null ? ` · ${Math.abs(state.days)} días ${state.days < 0 ? "vencido" : "restantes"}` : ""} · quedan {lot.quantity}</p></div><Button size="sm" variant="secondary" onClick={() => setActiveTab("lots")}>Ver lote</Button></div>; })}
              {recommendations.length === 0 && lotWarnings.length === 0 && <EmptyState icon={<CheckCircle2 className="h-9 w-9" />} title="Sin alertas operativas urgentes" text="Las previsiones se recalculan con ventas y órdenes registradas." />}
            </CardContent></Card>
            <Card><CardHeader title="Productos debajo del margen objetivo" subtitle="Calculado con costo de compra y precio de venta vigentes." /><CardContent>{marginWarnings.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">Todos los productos activos cumplen el margen mínimo.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3 pr-4">Producto</th><th className="pb-3 pr-4">Costo</th><th className="pb-3 pr-4">Venta</th><th className="pb-3">Margen</th></tr></thead><tbody>{marginWarnings.slice(0, 8).map((product) => <tr key={product.id} className="border-b last:border-0"><td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{product.name}</td><td className="py-3 pr-4">{formatCurrency(product.purchasePrice)}</td><td className="py-3 pr-4">{formatCurrency(product.salePrice)}</td><td className="py-3"><Badge variant="danger">{getGrossMarginPercent(product.purchasePrice, product.salePrice).toFixed(1)}%</Badge></td></tr>)}</tbody></table></div>}</CardContent></Card>
          </div>
          <div className="space-y-5">
            <Card><CardHeader title="Estatus del dispositivo" subtitle="Modo local-first" /><CardContent><div className={`flex items-start gap-3 rounded-xl p-4 ${online ? "bg-emerald-50 dark:bg-emerald-950/25" : "bg-amber-50 dark:bg-amber-950/25"}`}>{online ? <Wifi className="mt-0.5 h-5 w-5 text-emerald-600" /> : <CloudOff className="mt-0.5 h-5 w-5 text-amber-600" />}<div><p className="font-semibold text-slate-900 dark:text-white">{online ? "Conexión disponible" : "Sin conexión"}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Las ventas demo se guardan en este navegador. La PWA conserva las pantallas visitadas para acceso local.</p></div></div><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Sin base de datos y API de sincronización configuradas, no hay respaldo en nube ni sincronización entre cajas.</p></CardContent></Card>
            <Card><CardHeader title="Prioridades de hoy" /><CardContent className="space-y-2 text-sm"><PriorityLine icon={<CalendarClock className="h-4 w-4" />} title="Caducidades" value={`${lotWarnings.length} lotes por revisar`} onClick={() => setActiveTab("lots")} /><PriorityLine icon={<ArrowDownToLine className="h-4 w-4" />} title="Compras" value={`${recommendations.length} sugerencias`} onClick={() => setActiveTab("replenishment")} />{isManager && <PriorityLine icon={<FileCheck2 className="h-4 w-4" />} title="Facturación" value={`${invoiceRequests.length} solicitudes pendientes de PAC`} onClick={() => setActiveTab("invoices")} />}</CardContent></Card>
          </div>
        </div>}

        {activeTab === "lots" && <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummaryCard label="Lotes registrados" value={String(lots.length)} icon={<Boxes className="h-5 w-5" />} /><SummaryCard label="Por vencer en 30 días" value={String(lots.filter((lot) => { const state = getLotState(lot); return state.days !== null && state.days >= 0 && state.days <= 30 && lot.quantity > 0; }).length)} icon={<CalendarClock className="h-5 w-5" />} accent="amber" /><SummaryCard label="Vencidos con existencia" value={String(lots.filter((lot) => getLotState(lot).label === "Vencido").length)} icon={<AlertTriangle className="h-5 w-5" />} accent="red" /></div>
          <Card><CardHeader title="Trazabilidad FEFO" subtitle="Las ventas consumen primero el lote vigente que vence antes. El stock heredado sin lote queda identificado." action={<Button size="sm" onClick={openLotModal} leftIcon={<Plus className="h-4 w-4" />}>Registrar lote</Button>} /><CardContent>{lots.length === 0 ? <EmptyState icon={<Boxes className="h-9 w-9" />} title="Todavía no hay lotes" text="Registra una recepción o vincula stock actual sin sumarlo dos veces." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3 pr-4">Producto / lote</th><th className="pb-3 pr-4">Disponible</th><th className="pb-3 pr-4">Vence</th><th className="pb-3 pr-4">Costo</th><th className="pb-3 pr-4">Estado</th><th className="pb-3">Origen</th></tr></thead><tbody>{lots.map((lot) => { const state = getLotState(lot); return <tr key={lot.id} className="border-b last:border-0"><td className="py-3 pr-4"><p className="font-semibold text-slate-900 dark:text-white">{lot.productName}</p><p className="text-xs text-slate-500">Lote {lot.lotCode}</p></td><td className="py-3 pr-4">{lot.quantity} {products.find((item) => item.id === lot.productId)?.unit || "unid."}<span className="block text-xs text-slate-400">Recibido {lot.receivedQuantity}</span></td><td className="py-3 pr-4">{new Date(`${lot.expiresOn}T12:00:00`).toLocaleDateString("es-MX")}</td><td className="py-3 pr-4">{formatCurrency(lot.unitCost)}</td><td className="py-3 pr-4"><Badge variant={state.tone}>{state.label}</Badge>{state.days !== null && state.days >= 0 && state.days <= 30 && <p className="mt-1 text-xs text-slate-500">{state.days} días restantes</p>}</td><td className="py-3 text-xs text-slate-500">{lot.source === "purchase" ? "Recepción nueva" : "Stock existente"}<span className="block">{lot.receivedBy || "Usuario"}</span></td></tr>; })}</tbody></table></div>}</CardContent></Card>
          <Card><CardHeader title="Existencia pendiente de trazabilidad" subtitle="El sistema no la cambia hasta que se vincule explícitamente a un lote." /><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3 pr-4">Producto</th><th className="pb-3 pr-4">Stock total</th><th className="pb-3">Sin lote asignado</th></tr></thead><tbody>{products.filter((product) => product.stock > getTrackedLotQuantity(product.id, lots)).slice(0, 30).map((product) => <tr key={product.id} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{product.name}</td><td className="py-3 pr-4">{product.stock} {product.unit}</td><td className="py-3">{Math.max(0, product.stock - getTrackedLotQuantity(product.id, lots)).toFixed(isFractionalUnit(product.unit) ? 3 : 0)} {product.unit}</td></tr>)}</tbody></table></div></CardContent></Card>
        </div>}

        {activeTab === "replenishment" && <div className="space-y-5">
          <Card><CardHeader title="Parámetros de previsión" subtitle="Calculada con las ventas completadas de los últimos 30 días." /><CardContent><div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Input label="Cobertura deseada (días)" type="number" min="1" max="180" value={coverageDays} onChange={(event) => setCoverageOverride(Math.max(1, Number(event.target.value) || 1))} /><Input label="Entrega del proveedor (días)" type="number" min="0" max="90" value={leadTimeDays} onChange={(event) => setLeadOverride(Math.max(0, Number(event.target.value) || 0))} /><Button variant="secondary" onClick={saveForecastSettings}>Guardar parámetros</Button></div><p className="mt-3 text-xs text-slate-500">Meta = venta diaria promedio × (cobertura + tiempo de entrega), comparada con stock y órdenes pendientes. Sin historial, utiliza el stock mínimo.</p></CardContent></Card>
          <Card><CardHeader title="Plan de compra sugerido" subtitle={`${recommendations.length} recomendaciones · las órdenes abiertas se descuentan para evitar duplicados`} /><CardContent>{recommendations.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-9 w-9" />} title="Inventario cubierto" text="No hay faltantes previstos con los parámetros actuales." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3 pr-4">Prioridad / producto</th><th className="pb-3 pr-4">Stock + en camino</th><th className="pb-3 pr-4">Venta diaria</th><th className="pb-3 pr-4">Cobertura</th><th className="pb-3 pr-4">Pedir</th><th className="pb-3 pr-4">Costo aprox.</th><th className="pb-3">Proveedor</th></tr></thead><tbody>{recommendations.map((item) => { const product = products.find((entry) => entry.id === item.productId); const supplierId = supplierSelections[item.productId] || item.supplierId || ""; return <tr key={item.productId} className="border-b last:border-0"><td className="py-3 pr-4"><Badge variant={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "info"}>{item.priority === "critical" ? "Urgente" : item.priority === "high" ? "Alta" : "Normal"}</Badge><p className="mt-1 font-semibold text-slate-900 dark:text-white">{item.productName}</p></td><td className="py-3 pr-4">{item.stock} + {item.inbound} {item.unit}</td><td className="py-3 pr-4">{item.averageDailySales.toFixed(2)} / día</td><td className="py-3 pr-4">{item.daysOfCover === null ? "Sin historial" : `${item.daysOfCover} días`}</td><td className="py-3 pr-4 font-bold">{item.recommendedQuantity} {item.unit}</td><td className="py-3 pr-4">{formatCurrency(item.estimatedCost)}</td><td className="py-3"><div className="flex min-w-[210px] gap-2"><select aria-label={`Proveedor para ${item.productName}`} value={supplierId} onChange={(event) => setSupplierSelections((current) => ({ ...current, [item.productId]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"><option value="">Proveedor…</option>{suppliers.filter((supplier) => supplier.isActive).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><Button size="sm" disabled={!supplierId || !product} onClick={() => createSuggestedOrder(item)} title="Crea un borrador; no se envía automáticamente"><Plus className="h-4 w-4" /></Button></div></td></tr>; })}</tbody></table></div>}</CardContent></Card>
        </div>}

        {activeTab === "audit" && isManager && <Card><CardHeader title="Bitácora de actividad" subtitle={`${auditEvents.length} eventos recientes · retención local de hasta 5,000`} action={<Badge variant="warning">Solo dispositivo</Badge>} /><CardContent><div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200">Bitácora operativa visible en este dispositivo. No es inmutable ni sustituye un registro de servidor protegido.</div>{auditEvents.length === 0 ? <EmptyState icon={<ClipboardCheck className="h-9 w-9" />} title="Bitácora lista" text="Ventas, cambios de catálogo, órdenes, devoluciones, caja, lotes y solicitudes aparecerán aquí." /> : <div className="space-y-2">{auditEvents.slice(0, 150).map((event) => <div key={event.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-start dark:border-slate-700"><div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800"><Activity className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 dark:text-white">{event.summary}</p><Badge variant="secondary">{event.action}</Badge></div><p className="mt-1 text-xs text-slate-500">{event.actorName} · {formatDateTime(event.occurredAt)} · {event.entityType}{event.entityId ? ` · ${event.entityId.slice(0, 12)}` : ""}</p></div></div>)}</div>}</CardContent></Card>}

        {activeTab === "invoices" && isManager && <div className="space-y-5">
          <Card><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FileCheck2 className="h-5 w-5" /></div><div className="flex-1"><h3 className="font-bold text-slate-900 dark:text-white">Preparación de solicitudes fiscales</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Se validan y guardan receptor y ticket. <strong>No se genera ni se timbra CFDI</strong> hasta conectar un PAC autorizado con credenciales seguras en servidor.</p></div><Badge variant="warning">PAC no conectado</Badge></div></CardContent></Card>
          <Card><CardHeader title="Ventas completadas sin solicitud" subtitle={`${invoiceEligibleSales.length} tickets disponibles`} action={<Button size="sm" onClick={() => openInvoiceModal()} leftIcon={<Plus className="h-4 w-4" />}>Registrar solicitud</Button>} /><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3 pr-4">Ticket</th><th className="pb-3 pr-4">Fecha</th><th className="pb-3 pr-4">Total</th><th className="pb-3">Acción</th></tr></thead><tbody>{invoiceEligibleSales.slice(0, 20).map((sale) => <tr key={sale.id} className="border-b last:border-0"><td className="py-3 pr-4 font-mono font-semibold">{sale.ticketNumber}</td><td className="py-3 pr-4">{formatDateTime(sale.createdAt)}</td><td className="py-3 pr-4">{formatCurrency(sale.total)}</td><td className="py-3"><Button size="sm" variant="secondary" onClick={() => openInvoiceModal(sale)}>Capturar datos fiscales</Button></td></tr>)}</tbody></table></div></CardContent></Card>
          <Card><CardHeader title="Solicitudes guardadas" subtitle="Pendientes de transmitir a un proveedor de facturación." /><CardContent>{invoiceRequests.length === 0 ? <EmptyState icon={<FileText className="h-9 w-9" />} title="Sin solicitudes" text="Captura los datos fiscales desde un ticket completado." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3 pr-4">Ticket</th><th className="pb-3 pr-4">Receptor</th><th className="pb-3 pr-4">RFC</th><th className="pb-3 pr-4">Solicitud</th><th className="pb-3">Estado</th></tr></thead><tbody>{invoiceRequests.map((request) => <tr key={request.id} className="border-b last:border-0"><td className="py-3 pr-4 font-mono">{request.ticketNumber}</td><td className="py-3 pr-4">{request.legalName}</td><td className="py-3 pr-4">{request.rfc}</td><td className="py-3 pr-4">{formatDateTime(request.createdAt)}</td><td className="py-3"><Badge variant="warning">Pendiente de PAC</Badge></td></tr>)}</tbody></table></div>}</CardContent></Card>
        </div>}

        {activeTab === "integrations" && isManager && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><IntegrationCard icon={<CloudOff className="h-5 w-5" />} title="Modo sin conexión" status="PWA local" tone="success" text="Las pantallas y recursos estáticos visitados se conservan para acceso local. Los datos de demostración no se sincronizan entre dispositivos ni se respaldan en la nube." /><IntegrationCard icon={<WhatsAppMark />} title="WhatsApp" status="Compartir resumen" tone="success" text="El ticket abre WhatsApp con el resumen y total. El envío lo inicia manualmente el cajero; no se envían mensajes automáticos." /><IntegrationCard icon={<Package className="h-5 w-5" />} title="Báscula" status="Teclado HID" tone="info" text="Los productos configurados por kg, g, litro o ml aceptan fracciones y lectura tipo teclado USB. No hay protocolo serial propietario conectado." /><IntegrationCard icon={<FileCheck2 className="h-5 w-5" />} title="CFDI / PAC" status="Requiere proveedor" tone="warning" text="La aplicación registra solicitudes, pero para timbrar se requiere elegir un PAC e integrar sus credenciales únicamente en servidor." /></div>}

        <Modal isOpen={showLotModal} onClose={() => setShowLotModal(false)} title="Registrar lote y caducidad" size="lg"><form onSubmit={submitLot} className="space-y-4"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-200">El POS consume primero los lotes vigentes con vencimiento más próximo. Lotes vencidos trazados no se consideran vendibles.</div><div><label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Producto *</label><select value={lotForm.productId} onChange={(event) => setLotForm((form) => ({ ...form, productId: event.target.value }))} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"><option value="">Seleccionar producto…</option>{products.filter((product) => product.isActive).map((product) => <option key={product.id} value={product.id}>{product.name} · stock {product.stock} {product.unit}</option>)}</select></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="Código o folio del lote *" value={lotForm.lotCode} onChange={(event) => setLotForm((form) => ({ ...form, lotCode: event.target.value }))} placeholder="Ej. L240930-A" required /><Input label={`Cantidad (${products.find((product) => product.id === lotForm.productId)?.unit || "unidad"}) *`} type="number" min={isFractionalUnit(products.find((product) => product.id === lotForm.productId)?.unit || "pieza") ? "0.001" : "1"} step={isFractionalUnit(products.find((product) => product.id === lotForm.productId)?.unit || "pieza") ? "0.001" : "1"} value={lotForm.quantity} onChange={(event) => setLotForm((form) => ({ ...form, quantity: event.target.value }))} required /><Input label="Vencimiento *" type="date" min={lotForm.addToStock ? new Date().toISOString().slice(0, 10) : undefined} value={lotForm.expiresOn} onChange={(event) => setLotForm((form) => ({ ...form, expiresOn: event.target.value }))} required /><Input label="Costo unitario *" type="number" min="0" step="0.01" value={lotForm.unitCost} onChange={(event) => setLotForm((form) => ({ ...form, unitCost: event.target.value }))} required /></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" checked={lotForm.addToStock} onChange={(event) => setLotForm((form) => ({ ...form, addToStock: event.target.checked }))} className="mt-1 h-4 w-4 accent-blue-600" /><span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Mercancía nueva: sumarla al stock</span><span className="block text-xs text-slate-500">Desactiva para asignar un lote a existencias ya incluidas, sin duplicarlas.</span></span></label>{lotError && <p role="alert" className="text-sm font-medium text-red-600">{lotError}</p>}<div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setShowLotModal(false)}>Cancelar</Button><Button type="submit" leftIcon={<Plus className="h-4 w-4" />}>Guardar lote</Button></div></form></Modal>

        <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Registrar solicitud de factura" size="lg"><form onSubmit={submitInvoiceRequest} className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200"><strong>Importante:</strong> se registra una solicitud; esto no crea ni timbra un CFDI. Los datos fiscales se guardan en este dispositivo.</div><div><label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ticket completado *</label><select value={invoiceForm.saleId} onChange={(event) => setInvoiceForm((form) => ({ ...form, saleId: event.target.value }))} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"><option value="">Seleccionar ticket…</option>{(invoiceForm.saleId && sales.some((sale) => sale.id === invoiceForm.saleId) ? sales.filter((sale) => sale.status === "completed" && (sale.id === invoiceForm.saleId || !requestedSaleIds.has(sale.id))) : invoiceEligibleSales).map((sale) => <option key={sale.id} value={sale.id}>{sale.ticketNumber} · {formatDateTime(sale.createdAt)} · {formatCurrency(sale.total)}</option>)}</select></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="RFC receptor *" maxLength={13} value={invoiceForm.rfc} onChange={(event) => setInvoiceForm((form) => ({ ...form, rfc: event.target.value.toUpperCase() }))} placeholder="XAXX010101000" required /><Input label="Razón social / nombre fiscal *" value={invoiceForm.legalName} onChange={(event) => setInvoiceForm((form) => ({ ...form, legalName: event.target.value }))} required /><Input label="Código postal fiscal *" maxLength={5} inputMode="numeric" value={invoiceForm.postalCode} onChange={(event) => setInvoiceForm((form) => ({ ...form, postalCode: event.target.value.replace(/\D/g, "").slice(0, 5) }))} placeholder="00000" required /><Input label="Correo para entrega" type="email" value={invoiceForm.email} onChange={(event) => setInvoiceForm((form) => ({ ...form, email: event.target.value }))} /><div><label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Régimen fiscal *</label><select value={invoiceForm.fiscalRegime} onChange={(event) => setInvoiceForm((form) => ({ ...form, fiscalRegime: event.target.value }))} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"><option value="">Seleccionar…</option>{fiscalRegimes.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div><div><label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Uso de CFDI *</label><select value={invoiceForm.cfdiUse} onChange={(event) => setInvoiceForm((form) => ({ ...form, cfdiUse: event.target.value }))} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">{cfdiUses.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div></div>{invoiceForm.rfc && !isValidMexicanRFC(invoiceForm.rfc) && <p className="text-xs text-amber-700">Verifica formato y homoclave del RFC.</p>}{invoiceError && <p role="alert" className="text-sm font-medium text-red-600">{invoiceError}</p>}<div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setShowInvoiceModal(false)}>Cancelar</Button><Button type="submit" leftIcon={<FileText className="h-4 w-4" />}>Guardar solicitud</Button></div></form></Modal>
      </div>
    </ProtectedLayout>
  );
}

function RadarMetric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"><div className="flex items-center gap-2 text-xs font-medium text-slate-300">{icon}{label}</div><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-1 text-[11px] text-slate-400">{hint}</p></div>;
}
function SummaryCard({ label, value, icon, accent = "blue" }: { label: string; value: string; icon: React.ReactNode; accent?: "blue" | "amber" | "red" }) {
  const colors = { blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300", amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300", red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" };
  return <Card><CardContent className="flex items-center gap-4 p-5"><div className={`rounded-xl p-3 ${colors[accent]}`}>{icon}</div><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p></div></CardContent></Card>;
}
function PriorityLine({ icon, title, value, onClick }: { icon: React.ReactNode; title: string; value: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"><span className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800">{icon}</span><span className="flex-1"><span className="block font-semibold text-slate-900 dark:text-white">{title}</span><span className="text-xs text-slate-500">{value}</span></span><ArrowUpRight className="h-4 w-4 text-slate-400" /></button>;
}
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700"><div className="text-slate-300 dark:text-slate-600">{icon}</div><p className="mt-2 font-semibold text-slate-800 dark:text-white">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>;
}
function IntegrationCard({ icon, title, status, tone, text }: { icon: React.ReactNode; title: string; status: string; tone: "success" | "info" | "warning"; text: string }) {
  const variant = tone === "success" ? "success" : tone === "info" ? "info" : "warning";
  return <Card><CardContent className="p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800">{icon}</div><div className="flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-900 dark:text-white">{title}</h3><Badge variant={variant}>{status}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></div></div></CardContent></Card>;
}
function WhatsAppMark() { return <span className="text-lg font-black text-emerald-600">WA</span>; }

export default function OperationsPage() {
  return <ThemeProvider><AuthProvider><ToastProvider><OperationsContent /></ToastProvider></AuthProvider></ThemeProvider>;
}
