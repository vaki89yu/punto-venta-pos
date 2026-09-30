"use client";

import { useState, useEffect, useCallback } from "react";
import { Sale, CartItem, Customer, PaymentMethod } from "@/types";

export type SalePaymentDetails = { method: "cash" | "card" | "transfer"; amount: number; reference?: string }[];
async function apiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return new Error(payload?.error?.message || `Error del servidor (${response.status}).`);
}

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSales = useCallback(async () => {
    const response = await fetch("/api/sales", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw await apiError(response);
    const result = await response.json() as { sales: Sale[] };
    setSales(result.sales || []);
    setError(null);
    return result.sales || [];
  }, []);

  useEffect(() => {
    let active = true;
    refreshSales().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las ventas.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [refreshSales]);

  const generateTicketNumber = useCallback(() => {
    const now = new Date();
    const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const nonce = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return `TK-${day}-${nonce.toUpperCase()}`;
  }, []);

  const createSale = useCallback(async (
    cartItems: CartItem[],
    customer: Customer | null,
    _userId: string,
    paymentMethod: Exclude<PaymentMethod, "qr">,
    paymentDetails: SalePaymentDetails,
    cashReceived?: number,
    _change?: number,
    ticketNumber?: string,
  ): Promise<Sale> => {
    if (!cartItems.length) throw new Error("El carrito está vacío.");
    setError(null);
    const response = await fetch("/api/sales", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketNumber: ticketNumber || generateTicketNumber(),
        customerId: customer?.id || null,
        items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity, discountPercent: item.discount })),
        paymentMethod,
        paymentDetails,
        cashReceived,
      }),
    });
    if (!response.ok) {
      const cause = await apiError(response);
      setError(cause.message);
      throw cause;
    }
    const payload = await response.json() as { sale: Sale };
    const sale = payload.sale;
    setSales((current) => [sale, ...current.filter((item) => item.id !== sale.id)]);
    return sale;
  }, [generateTicketNumber]);

  const getSalesByDateRange = useCallback((startDate: Date, endDate: Date) => sales.filter((sale) => {
    const date = new Date(sale.createdAt);
    return date >= startDate && date <= endDate && sale.status === "completed";
  }), [sales]);
  const getTodaySales = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales.filter((sale) => new Date(sale.createdAt) >= today && sale.status === "completed");
  }, [sales]);
  const getSaleById = useCallback((id: string) => sales.find((sale) => sale.id === id), [sales]);

  const cancelSale = useCallback(async (id: string): Promise<boolean> => {
    const response = await fetch(`/api/sales/${encodeURIComponent(id)}/cancel`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw await apiError(response);
    const result = await response.json() as { sale: { id: string; status: Sale["status"]; updatedAt: string | Date } };
    setSales((current) => current.map((sale) => sale.id === id ? { ...sale, status: result.sale.status, updatedAt: new Date(result.sale.updatedAt) } : sale));
    return true;
  }, []);

  const getSalesStats = useCallback(() => {
    const todaySales = getTodaySales();
    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    const monthSales = sales.filter((sale) => new Date(sale.createdAt) >= month && sale.status === "completed");
    return {
      todayTotal: todaySales.reduce((sum, sale) => sum + sale.total, 0),
      todayTransactions: todaySales.length,
      todayProducts: todaySales.reduce((sum, sale) => sum + sale.items.reduce((count, item) => count + item.quantity, 0), 0),
      monthTotal: monthSales.reduce((sum, sale) => sum + sale.total, 0),
      totalSales: sales.filter((sale) => sale.status === "completed").length,
    };
  }, [sales, getTodaySales]);

  return { sales, isLoading, error, refreshSales, createSale, getSalesByDateRange, getTodaySales, getSaleById, cancelSale, getSalesStats };
}
