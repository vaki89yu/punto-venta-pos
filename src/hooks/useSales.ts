"use client";

import { useState, useEffect, useCallback } from "react";
import { Sale, SaleItem, CartItem, Customer, PaymentMethod } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { generateId } from "@/lib/utils";
import { updateProductInStore } from "@/lib/productStore";

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSales = localStorage.getItem(STORAGE_KEYS.SALES);
    if (storedSales) {
      setSales(JSON.parse(storedSales));
    }
    setIsLoading(false);
  }, []);

  const saveSales = useCallback((newSales: Sale[]) => {
    setSales(newSales);
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(newSales));
  }, []);

  const generateTicketNumber = useCallback(() => {
    const date = new Date();
    const prefix = "TK";
    const timestamp = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }, []);

  const createSale = useCallback((
    cartItems: CartItem[],
    customer: Customer | null,
    userId: string,
    paymentMethod: PaymentMethod,
    paymentDetails: { method: "cash" | "card" | "transfer" | "qr"; amount: number; reference?: string }[],
    cashReceived?: number,
    change?: number
  ): Sale => {
    const subtotal = cartItems.reduce((sum, item) => {
      const itemTotal = item.product.salePrice * item.quantity;
      const itemDiscount = itemTotal * (item.discount / 100);
      return sum + (itemTotal - itemDiscount);
    }, 0);

    const discount = cartItems.reduce((sum, item) => {
      const itemTotal = item.product.salePrice * item.quantity;
      return sum + (itemTotal * (item.discount / 100));
    }, 0);

    const taxRate = 0.16;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const saleItems: SaleItem[] = cartItems.map((item) => {
      const itemSubtotal = item.product.salePrice * item.quantity;
      const itemDiscount = itemSubtotal * (item.discount / 100);
      const itemTax = (itemSubtotal - itemDiscount) * taxRate;
      const itemTotal = itemSubtotal - itemDiscount + itemTax;

      return {
        id: generateId(),
        saleId: "",
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.salePrice,
        discount: itemDiscount,
        tax: itemTax,
        subtotal: itemSubtotal,
        total: itemTotal,
      };
    });

    const newSale: Sale = {
      id: generateId(),
      ticketNumber: generateTicketNumber(),
      customerId: customer?.id,
      userId,
      items: saleItems,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      paymentDetails,
      cashReceived,
      change,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // ─── Descontar stock del inventario global ───
    // Cada producto vendido reduce su stock y notifica a toda la app.
    cartItems.forEach((ci) => {
      updateProductInStore(ci.product.id, {
        stock: Math.max(0, ci.product.stock - ci.quantity),
      });
    });

    // Update sale items with the sale ID
    saleItems.forEach((item) => {
      item.saleId = newSale.id;
    });

    const updatedSales = [newSale, ...sales];
    saveSales(updatedSales);

    // Update customer stats if customer exists
    if (customer) {
      const customers = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || "[]");
      const updatedCustomers = customers.map((c: Customer) =>
        c.id === customer.id
          ? {
              ...c,
              totalSpent: c.totalSpent + total,
              totalPurchases: c.totalPurchases + 1,
              lastPurchase: new Date(),
            }
          : c
      );
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updatedCustomers));
    }

    return newSale;
  }, [sales, saveSales, generateTicketNumber]);

  const getSalesByDateRange = useCallback((startDate: Date, endDate: Date) => {
    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= startDate && saleDate <= endDate && sale.status === "completed";
    });
  }, [sales]);

  const getTodaySales = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= today && sale.status === "completed";
    });
  }, [sales]);

  const getSaleById = useCallback((id: string) => {
    return sales.find((s) => s.id === id);
  }, [sales]);

  const cancelSale = useCallback((id: string) => {
    const updatedSales = sales.map((s) =>
      s.id === id ? { ...s, status: "cancelled" as const, updatedAt: new Date() } : s
    );
    saveSales(updatedSales);
  }, [sales, saveSales]);

  const getSalesStats = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySales = getTodaySales();
    const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const todayTransactions = todaySales.length;
    const todayProducts = todaySales.reduce((sum, sale) => 
      sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const monthSales = sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= thisMonth && sale.status === "completed";
    });
    const monthTotal = monthSales.reduce((sum, sale) => sum + sale.total, 0);

    return {
      todayTotal,
      todayTransactions,
      todayProducts,
      monthTotal,
      totalSales: sales.filter((s) => s.status === "completed").length,
    };
  }, [sales, getTodaySales]);

  return {
    sales,
    isLoading,
    createSale,
    getSalesByDateRange,
    getTodaySales,
    getSaleById,
    cancelSale,
    getSalesStats,
  };
}
