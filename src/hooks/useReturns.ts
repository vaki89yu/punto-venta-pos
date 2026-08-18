"use client";

import { useState, useEffect, useCallback } from "react";
import { generateId } from "@/lib/utils";

export interface ReturnRecord {
  id: string;
  saleId: string;
  ticketNumber: string;
  items: {
    productId: string;
    productName: string;
    quantityReturned: number;
    price: number;
    refundAmount: number;
  }[];
  totalRefund: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  processedBy: string;
  createdAt: Date;
}

const RETURNS_KEY = "pos_returns";

export function useReturns() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(RETURNS_KEY);
    if (stored) setReturns(JSON.parse(stored));
  }, []);

  const saveReturns = useCallback((data: ReturnRecord[]) => {
    setReturns(data);
    localStorage.setItem(RETURNS_KEY, JSON.stringify(data));
  }, []);

  const createReturn = useCallback((data: Omit<ReturnRecord, "id" | "createdAt" | "status">) => {
    const newReturn: ReturnRecord = {
      ...data,
      id: generateId(),
      status: "approved",
      createdAt: new Date(),
    };
    const updated = [newReturn, ...returns];
    saveReturns(updated);
    return newReturn;
  }, [returns, saveReturns]);

  const getTotalRefunded = useCallback(() => {
    return returns.reduce((sum, r) => sum + r.totalRefund, 0);
  }, [returns]);

  return { returns, createReturn, getTotalRefunded };
}
