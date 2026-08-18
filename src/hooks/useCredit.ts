"use client";

import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "@/data/seed";
import { generateId } from "@/lib/utils";

export interface CreditSale {
  id: string;
  customerId: string;
  customerName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  amountPaid: number;
  balance: number;
  status: "pending" | "partial" | "paid";
  createdAt: Date;
  dueDate?: Date;
  payments: {
    amount: number;
    date: Date;
    note?: string;
  }[];
}

export function useCredit() {
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CREDIT_SALES);
    if (stored) {
      setCreditSales(JSON.parse(stored));
    }
  }, []);

  const saveCreditSales = useCallback((sales: CreditSale[]) => {
    setCreditSales(sales);
    localStorage.setItem(STORAGE_KEYS.CREDIT_SALES, JSON.stringify(sales));
  }, []);

  const addCreditSale = useCallback((sale: Omit<CreditSale, "id" | "createdAt">) => {
    const newSale: CreditSale = {
      ...sale,
      id: generateId(),
      createdAt: new Date(),
    };
    const updated = [newSale, ...creditSales];
    saveCreditSales(updated);
    return newSale;
  }, [creditSales, saveCreditSales]);

  const makePayment = useCallback((saleId: string, amount: number, note?: string) => {
    const updated = creditSales.map(sale => {
      if (sale.id === saleId) {
        const newAmountPaid = sale.amountPaid + amount;
        const newBalance = sale.total - newAmountPaid;
        return {
          ...sale,
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: (newBalance <= 0 ? "paid" : "partial") as "pending" | "partial" | "paid",
          payments: [
            ...sale.payments,
            { amount, date: new Date(), note }
          ]
        };
      }
      return sale;
    });
    saveCreditSales(updated);
  }, [creditSales, saveCreditSales]);

  const getPendingCredits = useCallback(() => {
    return creditSales.filter(s => s.status !== "paid");
  }, [creditSales]);

  const getTotalPending = useCallback(() => {
    return creditSales
      .filter(s => s.status !== "paid")
      .reduce((sum, s) => sum + s.balance, 0);
  }, [creditSales]);

  return {
    creditSales,
    addCreditSale,
    makePayment,
    getPendingCredits,
    getTotalPending,
  };
}
