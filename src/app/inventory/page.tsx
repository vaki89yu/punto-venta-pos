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
import { useProducts } from "@/hooks/useProducts";
import { Product, Category } from "@/types";
import { formatCurrency, generateSKU, generateBarcode } from "@/lib/utils";
import { STORAGE_KEYS } from "@/data/seed";
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
  const { products, addProduct, updateProduct, deleteProduct, getLowStockProducts, getOutOfStockProducts } = useProducts();
  const [categories, setCategories] = React.useState<Category[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (stored) setCategories(JSON.parse(stored));
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.barcode.includes(searchQuery);
    
    if (filterStatus === "low") return matchesSearch && p.stock <= p.minStock && p.stock > 0;
    if (filterStatus === "out") return matchesSearch && p.stock === 0;
    return matchesSearch;
  });

  const handleAddProduct = (formData: any) => {
    addProduct({
      ...formData,
      sku: formData.sku || generateSKU(),
      barcode: formData.barcode || generateBarcode(),
      isActive: true,
    });
    setShowAddModal(false);
    showToast("Producto agregado exitosamente", "success");
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      deleteProduct(id);
      showToast("Producto eliminado", "info");
    }
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
                        {product.stock}
                      </span>
                      <span className="text-sm text-slate-400 ml-1">/ {product.minStock} min</span>
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

        {/* Add product modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Agregar producto" size="lg">
          <ProductForm
            categories={categories}
            onSubmit={handleAddProduct}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        <StockAdjustModal
          product={adjustProduct}
          isOpen={!!adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onAdjust={(productId, newStock, reason) => {
            updateProduct(productId, { stock: newStock });
            showToast(`Stock actualizado a ${newStock} unidades`, "success");
          }}
        />
      </div>
    </ProtectedLayout>
  );
}

function ProductForm({ categories, onSubmit, onCancel }: { categories: Category[]; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    sku: generateSKU(),
    barcode: generateBarcode(),
    categoryId: "",
    purchasePrice: "",
    salePrice: "",
    stock: "",
    minStock: "5",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      purchasePrice: parseFloat(formData.purchasePrice),
      salePrice: parseFloat(formData.salePrice),
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock),
    });
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
          step="0.01"
          value={formData.salePrice}
          onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
          required
        />
        <Input
          label="Stock inicial *"
          type="number"
          value={formData.stock}
          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
          required
        />
        <Input
          label="Stock mínimo"
          type="number"
          value={formData.minStock}
          onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
        />
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
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
