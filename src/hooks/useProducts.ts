"use client";

import { useSyncExternalStore, useCallback, useState, useEffect } from "react";
import { Product } from "@/types";
import { generateId, generateSKU, generateBarcode } from "@/lib/utils";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  addProductToStore,
  updateProductInStore,
  deleteProductFromStore,
  findByBarcode,
  refresh,
} from "@/lib/productStore";

/** Client cache only; PostgreSQL through /api/products is the source of truth. */
export function useProducts() {
  const products = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    refresh().then(() => {
      if (active) { setIsLoading(false); setError(null); }
    }).catch((cause: unknown) => {
      if (active) {
        setIsLoading(false);
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el catálogo.");
      }
    });
    return () => { active = false; };
  }, []);

  const addProduct = useCallback(async (productData: Omit<Product, "id" | "createdAt" | "updatedAt"> & { marginOverrideReason?: string }) => {
    setError(null);
    const newProduct: Product & { marginOverrideReason?: string } = { ...productData, id: generateId(), createdAt: new Date(), updatedAt: new Date() };
    try { return await addProductToStore(newProduct); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo guardar el producto.";
      setError(message);
      throw cause;
    }
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>, stockReason?: string, marginOverrideReason?: string) => {
    setError(null);
    try { return await updateProductInStore(id, { ...updates, ...(stockReason ? { stockReason } : {}), ...(marginOverrideReason ? { marginOverrideReason } : {}) }); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo actualizar el producto.";
      setError(message);
      throw cause;
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setError(null);
    try { await deleteProductFromStore(id); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo retirar el producto.";
      setError(message);
      throw cause;
    }
  }, []);

  const getProductById = useCallback((id: string) => products.find((product) => product.id === id), [products]);
  const getProductByBarcode = useCallback((barcode: string) => findByBarcode(barcode), []);
  const getProductBySku = useCallback((sku: string) => products.find((product) => product.sku.toLowerCase() === sku.toLowerCase()), [products]);
  const searchProducts = useCallback((query: string) => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return products.filter((product) => product.isActive && (
      product.name.toLowerCase().includes(normalized) ||
      product.sku.toLowerCase().includes(normalized) ||
      product.barcode.includes(normalized) ||
      product.brand?.toLowerCase().includes(normalized)
    ));
  }, [products]);
  const getLowStockProducts = useCallback(() => products.filter((product) => product.stock <= product.minStock && product.stock > 0 && product.isActive), [products]);
  const getOutOfStockProducts = useCallback(() => products.filter((product) => product.stock === 0 && product.isActive), [products]);

  return {
    products,
    isLoading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    getProductByBarcode,
    getProductBySku,
    searchProducts,
    getLowStockProducts,
    getOutOfStockProducts,
    refreshProducts: refresh,
  };
}

export { generateSKU, generateBarcode };
