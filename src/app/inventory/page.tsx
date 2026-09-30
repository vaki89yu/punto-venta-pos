"use client";

import React, { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { StockAdjustModal } from "@/components/inventory/StockAdjustModal";
import { OpenFoodFactsCatalogPanel } from "@/components/inventory/OpenFoodFactsCatalogPanel";
import { useProducts } from "@/hooks/useProducts";
import { Product, Category } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatQuantity, getGrossMarginPercent, isFractionalUnit } from "@/lib/professionalFeatures";
import { formatCurrency, generateSKU, generateBarcode } from "@/lib/utils";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Barcode,
  Edit2,
  PackagePlus,
  Trash2,
  Filter,
  Download,
  Upload,
} from "lucide-react";

function InventoryContent() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { products, addProduct, updateProduct, deleteProduct, getLowStockProducts, getOutOfStockProducts } = useProducts();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [minimumMargin, setMinimumMargin] = React.useState(10);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/categories", { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
        const result = await response.json().catch(() => null) as { categories?: Category[]; error?: { message?: string } } | null;
        if (!response.ok) throw new Error(result?.error?.message || "No se pudieron cargar las categorías.");
        if (active) setCategories(result?.categories || []);
      }),
      fetch("/api/settings", { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
        const result = await response.json().catch(() => null) as { settings?: { minimumGrossMarginPercent?: number }; error?: { message?: string } } | null;
        if (response.ok && active) setMinimumMargin(Math.max(0, Math.min(90, Number(result?.settings?.minimumGrossMarginPercent ?? 10))));
      }),
    ]).catch((error: unknown) => showToast(error instanceof Error ? error.message : "No se pudo conectar con PostgreSQL.", "error"));
    return () => { active = false; };
  }, [showToast]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.barcode.includes(searchQuery);
    
    if (filterStatus === "low") return matchesSearch && p.stock <= p.minStock && p.stock > 0;
    if (filterStatus === "out") return matchesSearch && p.stock === 0;
    return matchesSearch;
  });

  const handleAddProduct = async (formData: any) => {
    const margin = getGrossMarginPercent(Number(formData.purchasePrice), Number(formData.salePrice));
    let marginOverrideReason: string | undefined;
    if (margin < minimumMargin) {
      if (user?.role !== "admin" && user?.role !== "manager") return showToast(`Margen ${margin.toFixed(1)}% menor al mínimo de ${minimumMargin}%; solicita autorización de gerencia.`, "error");
      marginOverrideReason = window.prompt(`Margen ${margin.toFixed(1)}%. Escribe el motivo para autorizar esta excepción:`)?.trim();
      if (!marginOverrideReason) return showToast("Se canceló: la excepción de margen requiere un motivo.", "warning");
    }
    try {
      await addProduct({
        ...formData,
        sku: formData.sku || generateSKU(),
        barcode: formData.barcode || generateBarcode(),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        tax: 16,
        isActive: true,
        ...(marginOverrideReason ? { marginOverrideReason } : {}),
      });
      setShowAddModal(false);
      showToast("Producto guardado en PostgreSQL", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo guardar el producto.", "error"); }
  };

  const handleUpdateProduct = async (formData: any) => {
    if (!editingProduct) return;
    const margin = getGrossMarginPercent(Number(formData.purchasePrice), Number(formData.salePrice));
    let marginOverrideReason: string | undefined;
    if (margin < minimumMargin) {
      if (user?.role !== "admin" && user?.role !== "manager") return showToast(`Margen ${margin.toFixed(1)}% menor al mínimo de ${minimumMargin}%; solicita autorización de gerencia.`, "error");
      marginOverrideReason = window.prompt(`Margen ${margin.toFixed(1)}%. Escribe el motivo para autorizar esta excepción:`)?.trim();
      if (!marginOverrideReason) return showToast("Se canceló: la excepción de margen requiere un motivo.", "warning");
    }
    const nextStock = Number(formData.stock);
    let stockReason: string | undefined;
    if (Math.abs(nextStock - editingProduct.stock) > 0.0001) {
      stockReason = window.prompt("Describe el motivo del ajuste de existencias:")?.trim();
      if (!stockReason) return showToast("El ajuste de existencias requiere un motivo.", "warning");
    }
    try {
      await updateProduct(editingProduct.id, {
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode,
        categoryId: formData.categoryId,
        description: formData.description,
        unit: formData.unit,
        purchasePrice: Number(formData.purchasePrice),
        salePrice: Number(formData.salePrice),
        minStock: Number(formData.minStock),
        ...(stockReason ? { stock: nextStock } : {}),
      }, stockReason, marginOverrideReason);
      setEditingProduct(null);
      showToast("Producto actualizado en PostgreSQL", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo actualizar el producto.", "error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Retirar este producto del catálogo? Se conserva el historial de ventas.")) return;
    try { await deleteProduct(id); showToast("Producto retirado del catálogo", "info"); }
    catch (error) { showToast(error instanceof Error ? error.message : "No se pudo retirar el producto.", "error"); }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventario</h1>
            <p className="text-slate-500 dark:text-slate-400">
              {products.length} productos registrados
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="w-5 h-5" />}>
            Agregar producto
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "all" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFilterStatus("all")}
                >
                  Todos
                </Button>
                <Button
                  variant={filterStatus === "low" ? "warning" : "secondary"}
                  size="sm"
                  onClick={() => setFilterStatus("low")}
                  leftIcon={<AlertTriangle className="w-4 h-4" />}
                >
                  Stock bajo
                </Button>
                <Button
                  variant={filterStatus === "out" ? "danger" : "secondary"}
                  size="sm"
                  onClick={() => setFilterStatus("out")}
                >
                  Agotados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products table */}
        <Card>
          <div className="overflow-x-auto mobile-scroll -mx-px">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Producto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">SKU</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Stock</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Precio</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                          <p className="text-sm text-slate-500">{categories.find(c => c.id === product.categoryId)?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{product.sku}</td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${
                        product.stock === 0 ? "text-red-600" :
                        product.stock <= product.minStock ? "text-amber-600" :
                        "text-emerald-600"
                      }`}>
                        {formatQuantity(product.stock, product.unit)}
                      </span>
                      <span className="text-sm text-slate-400 ml-1">/ {formatQuantity(product.minStock, product.unit)} mín.</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {formatCurrency(product.salePrice)}
                    </td>
                    <td className="px-6 py-4">
                      {product.stock === 0 ? (
                        <Badge variant="danger">Agotado</Badge>
                      ) : product.stock <= product.minStock ? (
                        <Badge variant="warning">Stock bajo</Badge>
                      ) : (
                        <Badge variant="success">Disponible</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setAdjustProduct(product)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                          title="Ajustar stock"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Catálogo de referencia Open Food Facts (productos inactivos, pendientes de precio) */}
        <OpenFoodFactsCatalogPanel />

        {/* Add product modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Agregar producto" size="lg">
          <ProductForm
            categories={categories}
            minimumMargin={minimumMargin}
            onSubmit={handleAddProduct}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title="Editar producto" size="lg">
          {editingProduct && (
            <ProductForm
              key={editingProduct.id}
              categories={categories}
              minimumMargin={minimumMargin}
              initialProduct={editingProduct}
              onSubmit={handleUpdateProduct}
              onCancel={() => setEditingProduct(null)}
            />
          )}
        </Modal>

        <StockAdjustModal
          product={adjustProduct}
          isOpen={!!adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onAdjust={async (productId, newStock, reason) => {
            try {
              await updateProduct(productId, { stock: newStock }, reason);
              showToast(`Existencia actualizada a ${newStock}; movimiento guardado en la bitácora`, "success");
              setAdjustProduct(null);
            } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo actualizar la existencia.", "error"); }
          }}
        />
      </div>
    </ProtectedLayout>
  );
}

function ProductForm({ categories, minimumMargin, initialProduct, onSubmit, onCancel }: { categories: Category[]; minimumMargin: number; initialProduct?: Product; onSubmit: (data: any) => void | Promise<void>; onCancel: () => void }) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(() => ({
    name: initialProduct?.name || "",
    sku: initialProduct?.sku || generateSKU(),
    barcode: initialProduct?.barcode || generateBarcode(),
    categoryId: initialProduct?.categoryId || "",
    unit: initialProduct?.unit || "pieza",
    purchasePrice: initialProduct ? String(initialProduct.purchasePrice) : "",
    salePrice: initialProduct ? String(initialProduct.salePrice) : "",
    stock: initialProduct ? String(initialProduct.stock) : "",
    minStock: initialProduct ? String(initialProduct.minStock) : "5",
    description: initialProduct?.description || "",
  }));

  const parsedCost = Number(formData.purchasePrice);
  const parsedPrice = Number(formData.salePrice);
  const currentMargin = formData.purchasePrice && formData.salePrice
    ? getGrossMarginPercent(parsedCost, parsedPrice)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit({
        ...formData,
        purchasePrice: parseFloat(formData.purchasePrice),
        salePrice: parseFloat(formData.salePrice),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
      });
    } finally { setIsSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input
            label="Nombre del producto *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <Input
          label="SKU"
          value={formData.sku}
          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
        />
        <Input
          label="Código de barras"
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
        />
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Categoría
          </label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Unidad de venta *</label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            <option value="pieza">Pieza (cantidad entera)</option>
            <option value="kg">Kilogramo (venta por peso)</option>
            <option value="g">Gramo (venta fraccionada)</option>
            <option value="litro">Litro (venta fraccionada)</option>
            <option value="ml">Mililitro (venta fraccionada)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Para kg, g, litros o ml, el punto de venta permite capturar hasta 3 decimales.</p>
        </div>
        <Input
          label="Precio de compra *"
          type="number"
          step="0.01"
          value={formData.purchasePrice}
          onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
          required
        />
        <Input
          label="Precio de venta *"
          type="number"
          min="0.01"
          step="0.01"
          value={formData.salePrice}
          onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
          required
        />
        {currentMargin !== null && (
          <div className={`col-span-2 rounded-xl border px-4 py-3 text-sm ${currentMargin >= minimumMargin ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`}>
            Margen bruto estimado: <strong>{currentMargin.toFixed(1)}%</strong> · mínimo configurado: <strong>{minimumMargin}%</strong>
          </div>
        )}
        <Input
          label={`Stock inicial * (${formData.unit})`}
          type="number"
          min="0"
          step={isFractionalUnit(formData.unit) ? "0.001" : "1"}
          value={formData.stock}
          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
          required
        />
        <Input
          label={`Stock mínimo (${formData.unit})`}
          type="number"
          min="0"
          step={isFractionalUnit(formData.unit) ? "0.001" : "1"}
          value={formData.minStock}
          onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
        />
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} isLoading={isSaving}>
          Guardar producto
        </Button>
      </div>
    </form>
  );
}

export default function InventoryPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <InventoryContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
