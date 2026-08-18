"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Product, Category, Supplier } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { generateSKU } from "@/lib/utils";
import { PackagePlus, Barcode, Truck, Tag, DollarSign, Layers, ShoppingCart, Check } from "lucide-react";

interface QuickProductModalProps {
  isOpen: boolean;
  barcode: string;
  onClose: () => void;
  onSave: (product: Omit<Product, "id" | "createdAt" | "updatedAt">, addToCart: boolean) => void;
  onScanAgain?: () => void;
}

export function QuickProductModal({ isOpen, barcode, onClose, onSave, onScanAgain }: QuickProductModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    supplierId: "",
    brand: "",
    purchasePrice: "",
    salePrice: "",
    stock: "",
    minStock: "5",
  });

  useEffect(() => {
    const cats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const sups = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    if (cats) setCategories(JSON.parse(cats));
    if (sups) setSuppliers(JSON.parse(sups));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: "",
        sku: generateSKU(),
        categoryId: "",
        supplierId: "",
        brand: "",
        purchasePrice: "",
        salePrice: "",
        stock: "",
        minStock: "5",
      });
    }
  }, [isOpen, barcode]);

  const margin =
    form.purchasePrice && form.salePrice
      ? (((parseFloat(form.salePrice) - parseFloat(form.purchasePrice)) / parseFloat(form.salePrice)) * 100).toFixed(1)
      : null;

  const buildProduct = (): Omit<Product, "id" | "createdAt" | "updatedAt"> => ({
    name: form.name,
    description: form.name,
    sku: form.sku || generateSKU(),
    barcode,
    categoryId: form.categoryId,
    supplierId: form.supplierId || undefined,
    brand: form.brand || undefined,
    purchasePrice: parseFloat(form.purchasePrice) || 0,
    salePrice: parseFloat(form.salePrice) || 0,
    stock: parseInt(form.stock) || 0,
    minStock: parseInt(form.minStock) || 5,
    unit: "pieza",
    tax: 16,
    isActive: true,
  });

  const isValid = form.name.trim() && form.salePrice && form.stock;

  const handleSubmit = (addToCart: boolean) => {
    if (!isValid) return;
    onSave(buildProduct(), addToCart);
  };

  const suggestPrice = (multiplier: number) => {
    if (!form.purchasePrice) return;
    const price = parseFloat(form.purchasePrice) * multiplier;
    setForm({ ...form, salePrice: price.toFixed(2) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg" hideCloseButton>
      <div className="-m-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Producto nuevo detectado</h2>
              <p className="text-emerald-50 text-sm">Registra este producto en tu inventario</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
            <Barcode className="w-4 h-4 flex-shrink-0" />
            <span className="font-mono font-bold tracking-wider text-sm truncate">{barcode}</span>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <Input
            label="Nombre del producto *"
            placeholder="Ej: Coca-Cola 600ml"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            leftIcon={<Tag className="w-4 h-4" />}
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Referencia (SKU)"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <Input
              label="Marca"
              placeholder="Ej: Coca-Cola"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>

          {/* Proveedor */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              <Truck className="w-4 h-4 inline mr-1" /> Proveedor
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm({ ...form, supplierId: s.id })}
                  className={`p-2.5 rounded-xl border-2 text-left transition-colors ${
                    form.supplierId === s.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <p className="font-bold text-xs text-slate-900 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{s.company}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              <Layers className="w-4 h-4 inline mr-1" /> Categoría
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...form, categoryId: c.id })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    form.categoryId === c.id
                      ? "text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  style={{ backgroundColor: form.categoryId === c.id ? c.color : undefined }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Precios */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio de compra"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              leftIcon={<DollarSign className="w-4 h-4" />}
            />
            <Input
              label="Precio de venta *"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              leftIcon={<DollarSign className="w-4 h-4" />}
            />
          </div>

          {form.purchasePrice && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 self-center">Sugerir precio:</span>
              {[1.2, 1.3, 1.4, 1.5].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => suggestPrice(m)}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100"
                >
                  +{((m - 1) * 100).toFixed(0)}%
                </button>
              ))}
              {margin && (
                <span className="ml-auto text-xs font-bold text-emerald-600 self-center">
                  Margen: {margin}%
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Stock inicial *"
              type="number"
              placeholder="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
            <Input
              label="Stock mínimo"
              type="number"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
          <Button
            fullWidth
            size="lg"
            onClick={() => handleSubmit(true)}
            disabled={!isValid}
            leftIcon={<ShoppingCart className="w-5 h-5" />}
          >
            Guardar y agregar al carrito
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="success"
              onClick={() => handleSubmit(false)}
              disabled={!isValid}
              leftIcon={<Check className="w-4 h-4" />}
            >
              Solo guardar
            </Button>
            {onScanAgain ? (
              <Button variant="secondary" onClick={onScanAgain} leftIcon={<Barcode className="w-4 h-4" />}>
                Escanear otro
              </Button>
            ) : (
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
            )}
          </div>
          {onScanAgain && (
            <button onClick={onClose} className="w-full text-center text-sm text-slate-400 hover:text-slate-600 py-1">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
