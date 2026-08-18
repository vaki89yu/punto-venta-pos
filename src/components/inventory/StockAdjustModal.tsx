"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Product } from "@/types";
import { Plus, Minus, RefreshCw, Package } from "lucide-react";

interface StockAdjustModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAdjust: (productId: string, newStock: number, reason: string) => void;
}

type Mode = "add" | "remove" | "set";

export function StockAdjustModal({ product, isOpen, onClose, onAdjust }: StockAdjustModalProps) {
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  if (!product) return null;

  const qty = parseInt(amount) || 0;
  const newStock =
    mode === "add" ? product.stock + qty :
    mode === "remove" ? Math.max(0, product.stock - qty) :
    qty;

  const handleSubmit = () => {
    if (!amount) return;
    onAdjust(product.id, newStock, reason || `Ajuste manual (${mode})`);
    setAmount("");
    setReason("");
    onClose();
  };

  const modes: { id: Mode; label: string; icon: any; color: string }[] = [
    { id: "add", label: "Entrada", icon: Plus, color: "emerald" },
    { id: "remove", label: "Salida", icon: Minus, color: "rose" },
    { id: "set", label: "Establecer", icon: RefreshCw, color: "blue" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Inventario" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
            {product.image ? (
              <img src={product.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{product.name}</p>
            <p className="text-sm text-slate-500">Stock actual: <span className="font-bold text-slate-800">{product.stock}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {modes.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                  mode === m.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{m.label}</span>
              </button>
            );
          })}
        </div>

        <Input
          label="Cantidad"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          autoFocus
        />

        <Input
          label="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Merma, recepción de mercancía, conteo físico..."
        />

        {amount && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
            <span className="text-sm text-blue-700">Nuevo stock</span>
            <span className="text-2xl font-bold text-blue-700">{newStock}</span>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancelar</Button>
          <Button fullWidth onClick={handleSubmit} disabled={!amount}>Aplicar ajuste</Button>
        </div>
      </div>
    </Modal>
  );
}
