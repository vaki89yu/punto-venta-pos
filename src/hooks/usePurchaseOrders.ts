"use client";

import { useState, useEffect, useCallback } from "react";
import { generateId } from "@/lib/utils";

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
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
  expectedDate?: Date;
  notes?: string;
  createdAt: Date;
  receivedAt?: Date;
}

const PO_KEY = "pos_purchase_orders";

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(PO_KEY);
    if (stored) setOrders(JSON.parse(stored));
  }, []);

  const saveOrders = useCallback((data: PurchaseOrder[]) => {
    setOrders(data);
    localStorage.setItem(PO_KEY, JSON.stringify(data));
  }, []);

  const generateOrderNumber = () => {
    return "OC-" + Date.now().toString(36).toUpperCase().slice(-8);
  };

  const createOrder = useCallback((data: Omit<PurchaseOrder, "id" | "orderNumber" | "createdAt" | "status">) => {
    const newOrder: PurchaseOrder = {
      ...data,
      id: generateId(),
      orderNumber: generateOrderNumber(),
      status: "pending",
      createdAt: new Date(),
    };
    const updated = [newOrder, ...orders];
    saveOrders(updated);
    return newOrder;
  }, [orders, saveOrders]);

  const updateOrderStatus = useCallback((id: string, status: PurchaseOrder["status"]) => {
    const updated = orders.map(o =>
      o.id === id ? { ...o, status, receivedAt: status === "received" ? new Date() : o.receivedAt } : o
    );
    saveOrders(updated);
  }, [orders, saveOrders]);

  const getPendingOrders = useCallback(() => {
    return orders.filter(o => o.status === "pending" || o.status === "ordered");
  }, [orders]);

  const getTotalPending = useCallback(() => {
    return getPendingOrders().reduce((sum, o) => sum + o.total, 0);
  }, [getPendingOrders]);

  return { orders, createOrder, updateOrderStatus, getPendingOrders, getTotalPending };
}
