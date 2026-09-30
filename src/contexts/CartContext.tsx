"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { CartItem, Product } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { getSellableStock, isFractionalUnit, roundQuantity } from "@/lib/professionalFeatures";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => boolean;
  updateDiscount: (productId: string, discount: number) => void;
  clearCart: () => void;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem(STORAGE_KEYS.CART);
      if (storedCart) {
        const parsed = JSON.parse(storedCart);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      setItems([]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (isHydrated) localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(items));
  }, [items, isHydrated]);

  const addItem = (product: Product, requestedQuantity = 1): boolean => {
    const quantity = isFractionalUnit(product.unit) ? roundQuantity(requestedQuantity) : Math.round(requestedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return false;

    const existing = items.find((item) => item.product.id === product.id);
    const available = getSellableStock(product.stock, product.id);
    if ((existing?.quantity || 0) + quantity > available + 0.0001) return false;

    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.product.id === product.id);
      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? { ...item, product, quantity: roundQuantity(item.quantity + quantity) }
            : item
        );
      }
      return [...currentItems, { product, quantity, discount: 0 }];
    });
    return true;
  };

  const removeItem = (productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, requestedQuantity: number): boolean => {
    if (requestedQuantity <= 0) {
      removeItem(productId);
      return true;
    }

    const item = items.find((current) => current.product.id === productId);
    if (!item) return false;
    const quantity = isFractionalUnit(item.product.unit) ? roundQuantity(requestedQuantity) : Math.round(requestedQuantity);
    if (quantity > getSellableStock(item.product.stock, productId) + 0.0001) return false;

    setItems((currentItems) => currentItems.map((current) =>
      current.product.id === productId ? { ...current, quantity } : current
    ));
    return true;
  };

  const updateDiscount = (productId: string, discount: number) => {
    const safeDiscount = Math.max(0, Math.min(100, Number.isFinite(discount) ? discount : 0));
    setItems((currentItems) => currentItems.map((item) =>
      item.product.id === productId ? { ...item, discount: safeDiscount } : item
    ));
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((sum, item) => {
    const gross = item.product.salePrice * item.quantity;
    return sum + gross * (1 - item.discount / 100);
  }, 0);

  const discount = items.reduce((sum, item) => {
    const gross = item.product.salePrice * item.quantity;
    return sum + gross * (item.discount / 100);
  }, 0);

  const tax = items.reduce((sum, item) => {
    const net = item.product.salePrice * item.quantity * (1 - item.discount / 100);
    return sum + net * (Math.max(0, item.product.tax || 0) / 100);
  }, 0);
  const total = subtotal + tax;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      updateDiscount,
      clearCart,
      subtotal,
      discount,
      tax,
      total,
      itemCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
