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
  getSnapshot as getCurrentProducts,
} from "@/lib/productStore";
import { recordAuditEvent } from "@/lib/professionalFeatures";

/**
 * Hook de productos con estado global compartido.
 *
 * Todas las pantallas (POS, inventario, reportes, notificaciones...)
 * comparten exactamente los mismos datos y se actualizan al instante.
 */
export function useProducts() {
  const products = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const addProduct = useCallback(
    (productData: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
      const newProduct: Product = {
        ...productData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const saved = addProductToStore(newProduct);
      recordAuditEvent({
        action: "product.created",
        entityType: "product",
        entityId: saved.id,
        summary: `Producto agregado al catálogo: ${saved.name}.`,
        metadata: { stock: saved.stock, salePrice: saved.salePrice, purchasePrice: saved.purchasePrice },
      });
      return saved;
    },
    []
  );

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const before = getCurrentProducts().find((product) => product.id === id);
    updateProductInStore(id, updates);
    if (before) {
      const changedFields = Object.keys(updates).filter((key) => key !== "updatedAt");
      recordAuditEvent({
        action: changedFields.includes("salePrice") ? "product.price.updated" : "product.updated",
        entityType: "product",
        entityId: id,
        summary: `Producto actualizado: ${before.name} (${changedFields.join(", ") || "sin cambios"}).`,
        metadata: {
          changedFields: changedFields.join(", "),
          previousStock: before.stock,
          stock: updates.stock ?? before.stock,
          previousSalePrice: before.salePrice,
          salePrice: updates.salePrice ?? before.salePrice,
        },
      });
    }
  }, []);

  const deleteProduct = useCallback((id: string) => {
    const product = getCurrentProducts().find((item) => item.id === id);
    deleteProductFromStore(id);
    if (product) {
      recordAuditEvent({
        action: "product.deleted",
        entityType: "product",
        entityId: id,
        summary: `Producto retirado del catálogo: ${product.name}.`,
        metadata: { sku: product.sku, stock: product.stock },
      });
    }
  }, []);

  const getProductById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products]
  );

  // Lee siempre del store (nunca de una copia obsoleta)
  const getProductByBarcode = useCallback(
    (barcode: string) => findByBarcode(barcode),
    []
  );

  const getProductBySku = useCallback(
    (sku: string) =>
      products.find((p) => p.sku.toLowerCase() === sku.toLowerCase()),
    [products]
  );

  const searchProducts = useCallback(
    (query: string) => {
      const q = query.toLowerCase().trim();
      if (!q) return [];
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.brand?.toLowerCase().includes(q)
      );
    },
    [products]
  );

  const getLowStockProducts = useCallback(
    () => products.filter((p) => p.stock <= p.minStock && p.stock > 0 && p.isActive),
    [products]
  );

  const getOutOfStockProducts = useCallback(
    () => products.filter((p) => p.stock === 0 && p.isActive),
    [products]
  );

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
    refreshProducts: refresh,
  };
}

export { generateSKU, generateBarcode };
