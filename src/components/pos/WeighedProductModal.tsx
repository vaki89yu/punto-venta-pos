"use client";

import { FormEvent, useState } from "react";
import { Product } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { formatQuantity, getSellableStock } from "@/lib/professionalFeatures";
import { Scale, Usb } from "lucide-react";

interface WeighedProductModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (product: Product, quantity: number) => void;
}

export function WeighedProductModal({ product, onClose, onConfirm }: WeighedProductModalProps) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  if (!product) return null;

  const available = getSellableStock(product.stock, product.id);
  const parsedQuantity = Number(quantity);
  const lineTotal = Number.isFinite(parsedQuantity) ? parsedQuantity * product.salePrice : 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextQuantity = Number(quantity);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setError("Ingresa un peso mayor a cero.");
      return;
    }
    if (nextQuantity > available + 0.0001) {
      setError(`El peso excede el disponible (${formatQuantity(available, product.unit)}).`);
      return;
    }
    onConfirm(product, Math.round(nextQuantity * 1000) / 1000);
    onClose();
  };

  return (
    <Modal isOpen={!!product} onClose={onClose} title="Venta por peso" size="sm">
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 p-4 dark:from-cyan-950/30 dark:to-blue-950/30">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-3 text-cyan-700 shadow-sm dark:bg-slate-800 dark:text-cyan-300">
              <Scale className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white">{product.name}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {formatCurrency(product.salePrice)} por {product.unit} · disponible {formatQuantity(available, product.unit)}
              </p>
            </div>
          </div>
        </div>

        <div>
          <Input
            label={`Peso (${product.unit}) *`}
            type="number"
            min="0.001"
            max={available}
            step="0.001"
            inputMode="decimal"
            autoFocus
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setError("");
              setReading(true);
            }}
            placeholder="Ej. 0.750"
            required
          />
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Usb className="h-3.5 w-3.5" />
            <span>Escribe el peso o usa una báscula USB configurada como teclado y presiona Enter.</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="text-sm text-slate-500 dark:text-slate-400">Importe estimado</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(lineTotal)}</span>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        {reading && <p className="text-xs text-emerald-700 dark:text-emerald-300">Lectura lista para confirmar; revisa que coincida con la báscula.</p>}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancelar</Button>
          <Button type="submit" fullWidth disabled={!quantity}>Agregar al carrito</Button>
        </div>
      </form>
    </Modal>
  );
}
