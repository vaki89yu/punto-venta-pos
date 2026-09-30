"use client";

import { useState, useEffect, useCallback } from "react";
import { Sale, SaleItem, CartItem, Customer, PaymentMethod, Product } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { generateId } from "@/lib/utils";
import { updateProductInStore } from "@/lib/productStore";
import { consumeLotsFEFO, getSellableStock, recordAuditEvent, restoreLotsFromSale } from "@/lib/professionalFeatures";

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
    change?: number,
    ticketNumber?: string
  ): Sale => {
    const storedProducts: Record<string, Product> = {};
    try {
      const parsed: Product[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || "[]");
      for (const product of parsed) storedProducts[product.id] = product;
    } catch {
      // Keep the sale path usable with the product snapshot already held by the cart.
    }

    const requestedByProduct = new Map<string, number>();
    for (const item of cartItems) {
      requestedByProduct.set(item.product.id, (requestedByProduct.get(item.product.id) || 0) + item.quantity);
    }
    for (const [productId, requestedQuantity] of requestedByProduct) {
      const product = storedProducts[productId] || cartItems.find((item) => item.product.id === productId)?.product;
      if (!product) throw new Error("Uno de los productos del carrito ya no existe.");
      const available = getSellableStock(product.stock, productId);
      if (requestedQuantity > available + 0.0001) {
        throw new Error(`Stock insuficiente de ${product.name}. Disponible: ${available} ${product.unit}.`);
      }
    }

    const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const saleItems: SaleItem[] = cartItems.map((item) => {
      const itemSubtotal = roundMoney(item.product.salePrice * item.quantity);
      const itemDiscount = roundMoney(itemSubtotal * (item.discount / 100));
      const taxableAmount = roundMoney(itemSubtotal - itemDiscount);
      const itemTax = roundMoney(taxableAmount * (Math.max(0, item.product.tax || 0) / 100));
      const itemTotal = roundMoney(taxableAmount + itemTax);

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

    const subtotal = roundMoney(saleItems.reduce((sum, item) => sum + item.subtotal - item.discount, 0));
    const discount = roundMoney(saleItems.reduce((sum, item) => sum + item.discount, 0));
    const tax = roundMoney(saleItems.reduce((sum, item) => sum + item.tax, 0));
    const total = roundMoney(saleItems.reduce((sum, item) => sum + item.total, 0));

    const newSale: Sale = {
      id: generateId(),
      ticketNumber: ticketNumber || generateTicketNumber(),
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

    // Descontar stock una sola vez por producto y consumir lotes FEFO cuando estén registrados.
    for (const [productId, quantity] of requestedByProduct) {
      const product = storedProducts[productId] || cartItems.find((item) => item.product.id === productId)!.product;
      const allocations = consumeLotsFEFO(productId, quantity);
      const saleItem = saleItems.find((item) => item.productId === productId);
      if (saleItem && allocations.length > 0) saleItem.lotAllocations = allocations;
      updateProductInStore(productId, {
        stock: Math.max(0, product.stock - quantity),
      });
    }

    // Update sale items with the sale ID
    saleItems.forEach((item) => {
      item.saleId = newSale.id;
    });

    const updatedSales = [newSale, ...sales];
    saveSales(updatedSales);
    recordAuditEvent({
      action: "sale.completed",
      entityType: "sale",
      entityId: newSale.id,
      summary: `Venta ${newSale.ticketNumber} completada por $${newSale.total.toFixed(2)}.`,
      metadata: { total: newSale.total, paymentMethod: newSale.paymentMethod, itemCount: cartItems.length },
      actorId: userId,
    });

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

  const cancelSale = useCallback((id: string): boolean => {
    const sale = sales.find((item) => item.id === id);
    if (!sale || sale.status !== "completed") return false;

    const returns = JSON.parse(localStorage.getItem(STORAGE_KEYS.RETURNS) || "[]") as { saleId?: string }[];
    if (returns.some((record) => record.saleId === sale.id)) {
      throw new Error("No se puede cancelar un ticket con devoluciones; procesa el ajuste con un gerente.");
    }

    const quantities = new Map<string, number>();
    for (const item of sale.items) {
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
      restoreLotsFromSale(item.lotAllocations || [], item.quantity);
    }
    let products: Product[] = [];
    try {
      products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || "[]");
    } catch {
      products = [];
    }
    for (const [productId, quantity] of quantities) {
      const product = products.find((item) => item.id === productId);
      if (product) updateProductInStore(productId, { stock: product.stock + quantity });
    }

    const updatedSales = sales.map((item) =>
      item.id === id ? { ...item, status: "cancelled" as const, updatedAt: new Date() } : item
    );
    saveSales(updatedSales);
    recordAuditEvent({
      action: "sale.cancelled",
      entityType: "sale",
      entityId: id,
      summary: `Venta ${sale.ticketNumber} cancelada; stock restituido al inventario.`,
      metadata: { total: sale.total, restoredLineCount: sale.items.length },
    });
    return true;
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
