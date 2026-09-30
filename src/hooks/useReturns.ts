"use client";

import { useCallback, useEffect, useState } from "react";
import { InventoryLotAllocation } from "@/lib/professionalFeatures";

export type RefundMethod = "cash" | "card" | "transfer";
export interface ReturnRecord {
  id: string;
  saleId: string;
  ticketNumber: string;
  items: {
    id?: string;
    saleItemId: string;
    productId: string;
    productName: string;
    quantityReturned: number;
    price: number;
    refundAmount: number;
    lotAllocations?: InventoryLotAllocation[];
  }[];
  totalRefund: number;
  reason: string;
  refundMethod: RefundMethod;
  status: "pending" | "approved" | "rejected";
  processedBy: string;
  createdAt: Date;
}

type CreateReturn = { saleId: string; reason: string; refundMethod: RefundMethod; items: { saleItemId: string; quantityReturned: number }[] };
function toReturnRecord(value: Omit<ReturnRecord, "createdAt"> & { createdAt: string | Date }): ReturnRecord {
  return { ...value, createdAt: value.createdAt instanceof Date ? value.createdAt : new Date(value.createdAt) };
}

export function useReturns() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/returns", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json().catch(() => null) as { returns?: (Omit<ReturnRecord, "createdAt"> & { createdAt: string })[]; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(result?.error?.message || "No se pudieron cargar las devoluciones.");
      setReturns((result?.returns || []).map(toReturnRecord));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las devoluciones.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createReturn = useCallback(async (data: CreateReturn) => {
    const response = await fetch("/api/returns", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => null) as { returnRecord?: Omit<ReturnRecord, "createdAt"> & { createdAt: string }; error?: { message?: string } } | null;
    if (!response.ok || !result?.returnRecord) throw new Error(result?.error?.message || "No se pudo registrar la devolución.");
    const record = toReturnRecord(result.returnRecord);
    setReturns((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    return record;
  }, []);

  const getTotalRefunded = useCallback(() => returns.reduce((sum, record) => sum + record.totalRefund, 0), [returns]);
  return { returns, createReturn, getTotalRefunded, refresh, isLoading, error };
}
