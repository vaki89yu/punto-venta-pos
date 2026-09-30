"use client";

import React, { useState } from "react";
import { Customer } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { formatQuantity, getMaxDiscountPercent, isFractionalUnit, recordAuditEvent } from "@/lib/professionalFeatures";
import { STORAGE_KEYS } from "@/data/seed";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  CreditCard,
  Banknote,
  ArrowRight,
  X,
  Receipt,
} from "lucide-react";

interface CartProps {
  customers: Customer[];
  selectedCustomer: Customer | null;
  onCustomerChange: (customer: Customer | null) => void;
  onCheckout: () => void;
}

export function Cart({ customers, selectedCustomer, onCustomerChange, onCheckout }: CartProps) {
  const { items, removeItem, updateQuantity, updateDiscount, subtotal, discount, tax, total, clearCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [minimumMargin, setMinimumMargin] = useState(10);
  const canManageDiscounts = user?.role === "admin" || user?.role === "manager";

  React.useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || "{}");
      const value = Number(settings.minimumGrossMarginPercent);
      if (Number.isFinite(value)) setMinimumMargin(Math.max(0, Math.min(90, value)));
    } catch {
      // Keep the conservative default margin floor.
    }
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch)
  );

  const handleQuantityChange = (productId: string, delta: number) => {
    const item = items.find((i) => i.product.id === productId);
    if (!item) return;
    const step = isFractionalUnit(item.product.unit) ? 0.05 : 1;
    if (delta < 0 && item.quantity <= step + 0.0001) {
      removeItem(productId);
      return;
    }
    const newQuantity = Math.max(step, item.quantity + delta * step);
    if (!updateQuantity(productId, newQuantity)) {
      showToast(`No hay suficiente stock disponible de ${item.product.name}`, "warning");
    }
  };

  const handleDiscountChange = (productId: string, requestedValue: number) => {
    const item = items.find((current) => current.product.id === productId);
    if (!item || !canManageDiscounts) return;
    const requested = Math.max(0, Math.min(100, Number.isFinite(requestedValue) ? requestedValue : 0));
    const cap = getMaxDiscountPercent(item.product.purchasePrice, item.product.salePrice, minimumMargin);
    const accepted = Math.min(requested, cap);
    updateDiscount(productId, accepted);
    if (accepted > 0) {
      recordAuditEvent({
        action: "sale.discount.applied",
        entityType: "cart_item",
        entityId: productId,
        summary: `Descuento de ${accepted.toFixed(1)}% aplicado a ${item.product.name}.`,
        metadata: { productId, discountPercent: accepted, minimumMarginPercent: minimumMargin },
      });
    }
    if (requested > cap + 0.01) {
      showToast(`Descuento limitado a ${cap.toFixed(1)}% para proteger el margen mínimo de ${minimumMargin}%`, "warning");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-700">Carrito</h2>
              <p className="text-sm text-slate-400">{items.length} {items.length === 1 ? "partida" : "partidas"}</p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Vaciar carrito"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Customer selector */}
        <button
          onClick={() => setShowCustomerModal(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <User className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex-1 text-left">
            {selectedCustomer ? (
              <>
                <p className="font-medium text-slate-900 dark:text-white">{selectedCustomer.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedCustomer.phone || selectedCustomer.email}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-700 dark:text-slate-300">Cliente general</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Seleccionar cliente</p>
              </>
            )}
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Carrito vacío</p>
            <p className="text-sm">Agrega productos para comenzar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                      {item.product.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCurrency(item.product.salePrice)} / {item.product.unit}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuantityChange(item.product.id, -1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      aria-label={`Cantidad de ${item.product.name}`}
                      type="number"
                      min={isFractionalUnit(item.product.unit) ? "0.001" : "1"}
                      step={isFractionalUnit(item.product.unit) ? "0.001" : "1"}
                      value={quantityDrafts[item.product.id] ?? String(item.quantity)}
                      onChange={(event) => setQuantityDrafts((current) => ({ ...current, [item.product.id]: event.target.value }))}
                      onBlur={() => {
                        const draft = quantityDrafts[item.product.id];
                        if (draft === undefined) return;
                        const next = Number(draft);
                        if (Number.isFinite(next) && next > 0) {
                          if (!updateQuantity(item.product.id, next)) {
                            showToast(`Cantidad mayor al stock disponible (${formatQuantity(item.product.stock, item.product.unit)})`, "warning");
                          }
                        }
                        setQuantityDrafts((current) => {
                          const nextDrafts = { ...current };
                          delete nextDrafts[item.product.id];
                          return nextDrafts;
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setQuantityDrafts((current) => {
                            const nextDrafts = { ...current };
                            delete nextDrafts[item.product.id];
                            return nextDrafts;
                          });
                        }
                      }}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      onClick={() => handleQuantityChange(item.product.id, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(item.product.salePrice * item.quantity)}
                  </span>
                </div>

                {canManageDiscounts && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Descuento autorizado</p>
                      <p className="text-[11px] text-slate-500">Máximo {getMaxDiscountPercent(item.product.purchasePrice, item.product.salePrice, minimumMargin).toFixed(1)}% para conservar {minimumMargin}% de margen</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        aria-label={`Descuento de ${item.product.name}`}
                        type="number"
                        min="0"
                        max={getMaxDiscountPercent(item.product.purchasePrice, item.product.salePrice, minimumMargin)}
                        step="0.5"
                        value={item.discount || ""}
                        placeholder="0"
                        onChange={(event) => handleDiscountChange(item.product.id, Number(event.target.value))}
                        className="w-16 rounded-md border border-slate-200 px-2 py-1 text-right text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </div>
                )}
                {item.discount > 0 && (
                  <Badge variant="success" size="sm" className="mt-2">
                    -{item.discount.toFixed(1)}% descuento
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
              <span>Descuento</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Impuestos</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <Button
          onClick={onCheckout}
          disabled={items.length === 0}
          fullWidth
          size="lg"
          leftIcon={<Receipt className="w-5 h-5" />}
        >
          Cobrar {items.length > 0 && formatCurrency(total)}
        </Button>
      </div>

      {/* Customer modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Seleccionar cliente"
      >
        <div className="space-y-4">
          <Input
            placeholder="Buscar cliente..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            <button
              onClick={() => {
                onCustomerChange(null);
                setShowCustomerModal(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                selectedCustomer === null
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-white">Cliente general</p>
                <p className="text-sm text-slate-500">Sin cliente específico</p>
              </div>
            </button>

            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  onCustomerChange(customer);
                  setShowCustomerModal(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  selectedCustomer?.id === customer.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{customer.name}</p>
                  <p className="text-sm text-slate-500">{customer.phone || customer.email}</p>
                </div>
                {customer.totalPurchases > 0 && (
                  <Badge variant="secondary" size="sm">
                    {customer.totalPurchases} compras
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
