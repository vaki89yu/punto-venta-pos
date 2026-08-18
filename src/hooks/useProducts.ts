"use client";

import { useState, useEffect, useCallback } from "react";
import { Product } from "@/types";
import { STORAGE_KEYS, demoProducts } from "@/data/seed";
import { generateId, generateSKU, generateBarcode } from "@/lib/utils";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (storedProducts) {
      setProducts(JSON.parse(storedProducts));
    } else {
      setProducts(demoProducts);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(demoProducts));
    }
    setIsLoading(false);
  }, []);

  const saveProducts = useCallback((newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(newProducts));
  }, []);

  const addProduct = useCallback((productData: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
    const newProduct: Product = {
      ...productData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedProducts = [...products, newProduct];
    saveProducts(updatedProducts);
    return newProduct;
  }, [products, saveProducts]);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const updatedProducts = products.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
    );
    saveProducts(updatedProducts);
  }, [products, saveProducts]);

  const deleteProduct = useCallback((id: string) => {
    const updatedProducts = products.filter((p) => p.id !== id);
    saveProducts(updatedProducts);
  }, [products, saveProducts]);

  const getProductById = useCallback((id: string) => {
    return products.find((p) => p.id === id);
  }, [products]);

  const getProductByBarcode = useCallback((barcode: string) => {
    const clean = (barcode || "").trim().replace(/\s+/g, "");
    if (!clean) return undefined;

    // 1. Coincidencia exacta
    let found = products.find((p) => p.barcode?.trim() === clean);
    if (found) return found;

    // 2. Ignorando ceros a la izquierda (UPC-A 12 dígitos vs EAN-13 con 0 inicial)
    const stripped = clean.replace(/^0+/, "");
    found = products.find((p) => p.barcode?.trim().replace(/^0+/, "") === stripped);
    if (found) return found;

    // 3. Comparar solo los últimos 12 dígitos (variantes UPC/EAN)
    if (clean.length >= 12) {
      const tail = clean.slice(-12);
      found = products.find((p) => {
        const pb = p.barcode?.trim() || "";
        return pb.length >= 12 && pb.slice(-12) === tail;
      });
      if (found) return found;
    }

    // 4. Buscar también por SKU (por si escanean etiqueta interna)
    found = products.find((p) => p.sku?.trim().toLowerCase() === clean.toLowerCase());
    return found;
  }, [products]);

  const getProductBySku = useCallback((sku: string) => {
    return products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  }, [products]);

  const searchProducts = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        p.barcode.includes(lowerQuery) ||
        p.brand?.toLowerCase().includes(lowerQuery)
    );
  }, [products]);

  const getLowStockProducts = useCallback(() => {
    return products.filter((p) => p.stock <= p.minStock && p.isActive);
  }, [products]);

  const getOutOfStockProducts = useCallback(() => {
    return products.filter((p) => p.stock === 0 && p.isActive);
  }, [products]);

  return {
    products,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    getProductByBarcode,
    getProductBySku,
    searchProducts,
    getLowStockProducts,
    getOutOfStockProducts,
  };
}

export { generateSKU, generateBarcode };
