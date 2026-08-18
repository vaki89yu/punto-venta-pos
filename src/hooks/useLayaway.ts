"use client";

import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "@/data/seed";
import { generateId } from "@/lib/utils";

export interface Layaway {
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
  deposit: number;
  balance: number;
  status: "active" | "completed" | "cancelled";
  createdAt: Date;
  expiryDate: Date;
  payments: {
    amount: number;
    date: Date;
  }[];
  notes?: string;
}

export function useLayaway() {
  const [layaways, setLayaways] = useState<Layaway[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.APARTADOS);
    if (stored) {
      setLayaways(JSON.parse(stored));
    }
  }, []);

  const saveLayaways = useCallback((data: Layaway[]) => {
    setLayaways(data);
    localStorage.setItem(STORAGE_KEYS.APARTADOS, JSON.stringify(data));
  }, []);

  const createLayaway = useCallback((data: Omit<Layaway, "id" | "createdAt" | "payments">) => {
    const newLayaway: Layaway = {
      ...data,
      id: generateId(),
      createdAt: new Date(),
      payments: [{ amount: data.deposit, date: new Date() }],
    };
    const updated = [newLayaway, ...layaways];
    saveLayaways(updated);
    return newLayaway;
  }, [layaways, saveLayaways]);

  const makePayment = useCallback((layawayId: string, amount: number) => {
    const updated = layaways.map(item => {
      if (item.id === layawayId) {
        const newBalance = item.balance - amount;
        return {
          ...item,
          balance: newBalance,
          status: newBalance <= 0 ? "completed" : item.status,
          payments: [...item.payments, { amount, date: new Date() }]
        };
      }
      return item;
    });
    saveLayaways(updated);
  }, [layaways, saveLayaways]);

  const cancelLayaway = useCallback((layawayId: string) => {
    const updated = layaways.map(item =>
      item.id === layawayId ? { ...item, status: "cancelled" as const } : item
    );
    saveLayaways(updated);
  }, [layaways, saveLayaways]);

  const getActiveLayaways = useCallback(() => {
    return layaways.filter(l => l.status === "active");
  }, [layaways]);

  return {
    layaways,
    createLayaway,
    makePayment,
    cancelLayaway,
    getActiveLayaways,
  };
}
