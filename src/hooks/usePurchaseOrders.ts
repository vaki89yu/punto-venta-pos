"use client";

import { useCallback, useEffect, useState } from "react";

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  receivedQuantity?: number;
  unitCost: number;
  total: number;
}
export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  total: number;
  status: "pending" | "ordered" | "received" | "cancelled";
  expectedDate?: Date | string;
  notes?: string;
  createdAt: Date | string;
  receivedAt?: Date | string;
}
export type PurchaseReceipt = { productId: string; lotCode: string; expiresOn?: string | null }[];

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return new Error(payload?.error?.message || `Error del servidor (${response.status}).`);
}

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshOrders = useCallback(async () => {
    const response = await fetch("/api/purchase-orders", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw await responseError(response);
    const payload = await response.json() as { orders: PurchaseOrder[] };
    setOrders(payload.orders || []);
    setError(null);
    return payload.orders || [];
  }, []);
  useEffect(() => {
    let active = true;
    refreshOrders().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las órdenes."); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [refreshOrders]);

  const createOrder = useCallback(async (data: Omit<PurchaseOrder, "id" | "orderNumber" | "createdAt" | "status">) => {
    const response = await fetch("/api/purchase-orders", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId: data.supplierId, items: data.items.map(({ productId, quantity, unitCost }) => ({ productId, quantity, unitCost })), expectedDate: data.expectedDate ? new Date(data.expectedDate).toISOString() : undefined, notes: data.notes }),
    });
    if (!response.ok) throw await responseError(response);
    const result = await response.json() as { order: PurchaseOrder };
    setOrders((current) => [result.order, ...current]);
    return result.order;
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: PurchaseOrder["status"], receipts?: PurchaseReceipt) => {
    const response = await fetch(`/api/purchase-orders/${encodeURIComponent(id)}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, receipts }),
    });
    if (!response.ok) throw await responseError(response);
    const result = await response.json() as { order: { id: string; status: PurchaseOrder["status"]; receivedAt?: Date | string } };
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status: result.order.status, receivedAt: result.order.receivedAt } : order));
  }, []);

  const getPendingOrders = useCallback(() => orders.filter((order) => order.status === "pending" || order.status === "ordered"), [orders]);
  const getTotalPending = useCallback(() => getPendingOrders().reduce((sum, order) => sum + order.total, 0), [getPendingOrders]);
  return { orders, isLoading, error, refreshOrders, createOrder, updateOrderStatus, getPendingOrders, getTotalPending };
}
