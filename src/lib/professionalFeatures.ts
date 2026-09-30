const CURRENT_USER_KEY = "pos_current_user";

export const FEATURE_STORAGE_KEYS = {
  LOTS: "pos_inventory_lots_v1",
  AUDIT: "pos_audit_log_v1",
  INVOICE_REQUESTS: "pos_invoice_requests_v1",
};

export interface InventoryLotAllocation {
  lotId: string;
  lotCode: string;
  quantity: number;
}

export interface InventoryLot {
  id: string;
  productId: string;
  productName: string;
  lotCode: string;
  quantity: number;
  receivedQuantity: number;
  expiresOn: string;
  unitCost: number;
  receivedAt: string;
  receivedBy?: string;
  source: "opening" | "purchase";
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface InvoiceRequest {
  id: string;
  saleId: string;
  ticketNumber: string;
  rfc: string;
  legalName: string;
  postalCode: string;
  fiscalRegime: string;
  cfdiUse: string;
  email: string;
  status: "pending_pac";
  createdAt: string;
  requestedBy: string;
}

export interface ReplenishmentProduct {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  supplierId?: string;
}

export interface ReplenishmentSale {
  status: string;
  createdAt: string | Date;
  items: { productId: string; quantity: number }[];
}

export interface ReplenishmentOrder {
  status: string;
  items: { productId: string; quantity: number }[];
}

export interface ReplenishmentRecommendation {
  productId: string;
  productName: string;
  unit: string;
  supplierId?: string;
  stock: number;
  inbound: number;
  averageDailySales: number;
  daysOfCover: number | null;
  recommendedQuantity: number;
  estimatedCost: number;
  priority: "critical" | "high" | "normal";
}

const QUANTITY_PRECISION = 1000;

export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * QUANTITY_PRECISION) / QUANTITY_PRECISION;
}

export function isFractionalUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase().replaceAll(".", "");
  return ["kg", "kilo", "kilos", "kilogramo", "kilogramos", "g", "gr", "gramo", "gramos", "l", "lt", "litro", "litros", "ml"].includes(normalized);
}

export function formatQuantity(value: number, unit: string): string {
  const quantity = isFractionalUnit(unit)
    ? new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(value)
    : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value);
  return `${quantity} ${unit}`;
}

export function getGrossMarginPercent(cost: number, price: number): number {
  if (!Number.isFinite(cost) || !Number.isFinite(price) || price <= 0) return -100;
  return ((price - cost) / price) * 100;
}

/** Porcentaje de descuento máximo que conserva el margen mínimo sobre el precio neto. */
export function getMaxDiscountPercent(cost: number, price: number, minimumMarginPercent: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const margin = Math.min(99, Math.max(0, minimumMarginPercent)) / 100;
  const minimumNetPrice = Math.max(0, cost) / (1 - margin);
  return Math.max(0, Math.min(100, ((price - minimumNetPrice) / price) * 100));
}

function stableId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function notifyLocalChange(key: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pos:local-change", { detail: { key } }));
  }
}

export function getInventoryLots(): InventoryLot[] {
  return readArray<InventoryLot>(FEATURE_STORAGE_KEYS.LOTS);
}

export function saveInventoryLots(lots: InventoryLot[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FEATURE_STORAGE_KEYS.LOTS, JSON.stringify(lots));
  notifyLocalChange(FEATURE_STORAGE_KEYS.LOTS);
}

export function getTrackedLotQuantity(productId: string, lots = getInventoryLots()): number {
  return roundQuantity(lots
    .filter((lot) => lot.productId === productId)
    .reduce((sum, lot) => sum + Math.max(0, Number(lot.quantity) || 0), 0));
}

function isExpired(expiresOn: string, now = new Date()): boolean {
  if (!expiresOn) return false;
  const expiry = new Date(`${expiresOn}T23:59:59`);
  return Number.isFinite(expiry.getTime()) && expiry < now;
}

export function getSellableStock(stock: number, productId: string, lots = getInventoryLots(), now = new Date()): number {
  const productLots = lots.filter((lot) => lot.productId === productId);
  if (productLots.length === 0) return Math.max(0, roundQuantity(stock));
  const trackedQuantity = productLots.reduce((sum, lot) => sum + Math.max(0, Number(lot.quantity) || 0), 0);
  const untrackedQuantity = Math.max(0, stock - trackedQuantity);
  const sellableTrackedQuantity = productLots
    .filter((lot) => !isExpired(lot.expiresOn, now))
    .reduce((sum, lot) => sum + Math.max(0, Number(lot.quantity) || 0), 0);
  return roundQuantity(Math.min(stock, untrackedQuantity + sellableTrackedQuantity));
}

/** Consume lots FEFO (first expiry, first out); untracked legacy stock remains supported. */
export function consumeLotsFEFO(productId: string, quantity: number, now = new Date()): InventoryLotAllocation[] {
  const lots = getInventoryLots();
  let remaining = Math.max(0, quantity);
  const allocations: InventoryLotAllocation[] = [];
  const eligible = lots
    .filter((lot) => lot.productId === productId && !isExpired(lot.expiresOn, now) && lot.quantity > 0)
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.receivedAt.localeCompare(b.receivedAt));

  for (const lot of eligible) {
    if (remaining <= 0) break;
    const take = roundQuantity(Math.min(lot.quantity, remaining));
    lot.quantity = roundQuantity(lot.quantity - take);
    remaining = roundQuantity(remaining - take);
    if (take > 0) allocations.push({ lotId: lot.id, lotCode: lot.lotCode, quantity: take });
  }

  if (allocations.length > 0) saveInventoryLots(lots);
  return allocations;
}

/** Restore only portions that came from tracked lots; unidentified legacy stock remains untracked. */
export function restoreLotsFromSale(
  originalAllocations: InventoryLotAllocation[],
  quantity: number,
  previouslyReturned: InventoryLotAllocation[] = []
): InventoryLotAllocation[] {
  const lots = getInventoryLots();
  const remainingByLot = new Map<string, number>();
  for (const allocation of originalAllocations) {
    const alreadyReturned = previouslyReturned
      .filter((returned) => returned.lotId === allocation.lotId)
      .reduce((sum, returned) => sum + returned.quantity, 0);
    remainingByLot.set(allocation.lotId, Math.max(0, roundQuantity(allocation.quantity - alreadyReturned)));
  }

  let remaining = Math.max(0, quantity);
  const restored: InventoryLotAllocation[] = [];
  for (const allocation of originalAllocations) {
    if (remaining <= 0) break;
    const available = remainingByLot.get(allocation.lotId) || 0;
    const lot = lots.find((candidate) => candidate.id === allocation.lotId);
    if (available <= 0 || !lot) continue;
    const restore = roundQuantity(Math.min(available, remaining));
    lot.quantity = roundQuantity(lot.quantity + restore);
    remaining = roundQuantity(remaining - restore);
    remainingByLot.set(allocation.lotId, roundQuantity(available - restore));
    restored.push({ lotId: allocation.lotId, lotCode: allocation.lotCode, quantity: restore });
  }

  if (restored.length > 0) saveInventoryLots(lots);
  return restored;
}

export function addInventoryLot(input: Omit<InventoryLot, "id" | "receivedAt"> & { receivedAt?: string }): InventoryLot {
  const lot: InventoryLot = {
    ...input,
    id: stableId("lot"),
    quantity: roundQuantity(input.quantity),
    receivedAt: input.receivedAt || new Date().toISOString(),
  };
  saveInventoryLots([lot, ...getInventoryLots()]);
  return lot;
}

export function getAuditEvents(): AuditEvent[] {
  return readArray<AuditEvent>(FEATURE_STORAGE_KEYS.AUDIT);
}

export function recordAuditEvent(input: Omit<AuditEvent, "id" | "occurredAt" | "actorId" | "actorName"> & { actorId?: string; actorName?: string; occurredAt?: string }): AuditEvent {
  if (typeof window === "undefined") {
    return {
      ...input,
      id: stableId("audit"),
      occurredAt: input.occurredAt || new Date().toISOString(),
      actorId: input.actorId || "system",
      actorName: input.actorName || "Sistema",
    };
  }

  let currentUser: { id?: string; name?: string } | null = null;
  try {
    currentUser = JSON.parse(window.localStorage.getItem(CURRENT_USER_KEY) || "null");
  } catch {
    currentUser = null;
  }

  const event: AuditEvent = {
    ...input,
    id: stableId("audit"),
    occurredAt: input.occurredAt || new Date().toISOString(),
    actorId: input.actorId || currentUser?.id || "system",
    actorName: input.actorName || currentUser?.name || "Sistema",
  };
  const events = [event, ...getAuditEvents()].slice(0, 5000);
  window.localStorage.setItem(FEATURE_STORAGE_KEYS.AUDIT, JSON.stringify(events));
  notifyLocalChange(FEATURE_STORAGE_KEYS.AUDIT);
  return event;
}

export function getInvoiceRequests(): InvoiceRequest[] {
  return readArray<InvoiceRequest>(FEATURE_STORAGE_KEYS.INVOICE_REQUESTS);
}

export function isValidMexicanRFC(rfc: string): boolean {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
}

export function createInvoiceRequest(input: Omit<InvoiceRequest, "id" | "status" | "createdAt" | "requestedBy">): InvoiceRequest {
  const requests = getInvoiceRequests();
  if (requests.some((request) => request.saleId === input.saleId)) {
    throw new Error("Este ticket ya tiene una solicitud de factura registrada.");
  }
  if (!isValidMexicanRFC(input.rfc)) throw new Error("Captura un RFC válido de persona física o moral.");
  if (!/^\d{5}$/.test(input.postalCode)) throw new Error("El código postal fiscal debe tener 5 dígitos.");
  if (!/^\d{3}$/.test(input.fiscalRegime)) throw new Error("Selecciona un régimen fiscal válido.");
  if (!/^[A-Z0-9]{3,4}$/.test(input.cfdiUse)) throw new Error("Selecciona un uso de CFDI válido.");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("El correo electrónico no parece válido.");

  let requestedBy = "Usuario";
  if (typeof window !== "undefined") {
    try {
      const current = JSON.parse(window.localStorage.getItem(CURRENT_USER_KEY) || "null");
      requestedBy = current?.name || requestedBy;
    } catch {
      // El registro sigue siendo posible en modo local.
    }
  }

  const request: InvoiceRequest = {
    ...input,
    id: stableId("invoice-request"),
    rfc: input.rfc.trim().toUpperCase(),
    legalName: input.legalName.trim(),
    postalCode: input.postalCode.trim(),
    email: input.email.trim().toLowerCase(),
    status: "pending_pac",
    createdAt: new Date().toISOString(),
    requestedBy,
  };
  if (!request.legalName) throw new Error("La razón social o nombre fiscal es obligatorio.");
  if (typeof window !== "undefined") {
    window.localStorage.setItem(FEATURE_STORAGE_KEYS.INVOICE_REQUESTS, JSON.stringify([request, ...requests]));
    notifyLocalChange(FEATURE_STORAGE_KEYS.INVOICE_REQUESTS);
  }
  recordAuditEvent({
    action: "invoice.request.created",
    entityType: "invoice_request",
    entityId: request.id,
    summary: `Solicitud de factura registrada para ${request.ticketNumber}; pendiente de integración PAC.`,
    metadata: { saleId: request.saleId, rfc: request.rfc, status: request.status },
  });
  return request;
}

function roundRecommendedQuantity(quantity: number, unit: string): number {
  return isFractionalUnit(unit) ? roundQuantity(quantity) : Math.ceil(quantity);
}

export function calculateReplenishmentRecommendations(
  products: ReplenishmentProduct[],
  sales: ReplenishmentSale[],
  orders: ReplenishmentOrder[],
  options: { daysToAnalyze?: number; coverageDays?: number; leadTimeDays?: number; now?: Date } = {}
): ReplenishmentRecommendation[] {
  const daysToAnalyze = Math.max(1, Math.floor(options.daysToAnalyze ?? 30));
  const coverageDays = Math.max(1, Math.floor(options.coverageDays ?? 14));
  const leadTimeDays = Math.max(0, Math.floor(options.leadTimeDays ?? 7));
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - daysToAnalyze * 24 * 60 * 60 * 1000;
  const demand = new Map<string, number>();
  const inbound = new Map<string, number>();

  for (const sale of sales) {
    if (sale.status !== "completed" || new Date(sale.createdAt).getTime() < cutoff) continue;
    for (const item of sale.items) {
      demand.set(item.productId, (demand.get(item.productId) || 0) + Math.max(0, Number(item.quantity) || 0));
    }
  }
  for (const order of orders) {
    if (order.status === "received" || order.status === "cancelled") continue;
    for (const item of order.items) {
      inbound.set(item.productId, (inbound.get(item.productId) || 0) + Math.max(0, Number(item.quantity) || 0));
    }
  }

  return products.flatMap((product) => {
    const averageDailySales = (demand.get(product.id) || 0) / daysToAnalyze;
    const available = Math.max(0, product.stock) + (inbound.get(product.id) || 0);
    const target = Math.max(product.minStock || 0, averageDailySales * (coverageDays + leadTimeDays));
    const quantity = roundRecommendedQuantity(Math.max(0, target - available), product.unit);
    if (quantity <= 0) return [];
    const daysOfCover = averageDailySales > 0 ? product.stock / averageDailySales : null;
    const priority = product.stock <= 0 || (daysOfCover !== null && daysOfCover <= leadTimeDays)
      ? "critical"
      : product.stock <= product.minStock || (daysOfCover !== null && daysOfCover <= leadTimeDays + 3)
        ? "high"
        : "normal";
    return [{
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      supplierId: product.supplierId,
      stock: product.stock,
      inbound: inbound.get(product.id) || 0,
      averageDailySales,
      daysOfCover: daysOfCover === null ? null : Math.max(0, roundQuantity(daysOfCover)),
      recommendedQuantity: quantity,
      estimatedCost: Math.round(quantity * product.purchasePrice * 100) / 100,
      priority,
    } satisfies ReplenishmentRecommendation];
  }).sort((a, b) => {
    const priority = { critical: 0, high: 1, normal: 2 };
    const priorityDifference = priority[a.priority] - priority[b.priority];
    if (priorityDifference !== 0) return priorityDifference;
    if (a.daysOfCover === null) return b.daysOfCover === null ? 0 : 1;
    if (b.daysOfCover === null) return -1;
    return a.daysOfCover - b.daysOfCover;
  });
}

export function normalizeWhatsAppPhone(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `52${digits}`;
  if (digits.startsWith("521") && digits.length === 13) digits = `52${digits.slice(3)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  const recipient = normalizeWhatsAppPhone(phone);
  const base = recipient ? `https://wa.me/${recipient}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}
