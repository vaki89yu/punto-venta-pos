"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { PaymentMethod, CartItem, Customer } from "@/types";
import {
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Wallet,
  Receipt,
  CheckCircle,
  Printer,
  Share2,
  Plus,
  X,
} from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  subtotal: number;
  tax: number;
  items: CartItem[];
  customer: Customer | null;
  onComplete: (paymentData: {
    method: PaymentMethod;
    cashReceived?: number;
    change?: number;
    paymentDetails: { method: "cash" | "card" | "transfer"; amount: number; reference?: string }[];
  }) => void;
}

export function CheckoutModal({
  isOpen,
  onClose,
  total,
  subtotal,
  tax,
  items,
  customer,
  onComplete,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [mixedPayments, setMixedPayments] = useState<
    { method: "cash" | "card" | "transfer"; amount: number; reference?: string }[]
  >([]);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const change = paymentMethod === "cash" && cashReceived
    ? parseFloat(cashReceived) - total
    : 0;

  const mixedTotal = mixedPayments.reduce((sum, p) => sum + p.amount, 0);
  const mixedRemaining = total - mixedTotal;

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod("cash");
      setCashReceived("");
      setMixedPayments([]);
      setShowTicket(false);
    }
  }, [isOpen]);

  const handleComplete = () => {
    if (paymentMethod === "mixed" && mixedRemaining > 0) {
      return;
    }

    const paymentData = {
      method: paymentMethod,
      cashReceived: paymentMethod === "cash" ? parseFloat(cashReceived) : undefined,
      change: change > 0 ? change : undefined,
      paymentDetails:
        paymentMethod === "mixed"
          ? mixedPayments
          : [{ method: paymentMethod as "cash" | "card" | "transfer", amount: total }],
    };

    const ticket = "TK" + Date.now().toString(36).toUpperCase();
    setTicketNumber(ticket);
    setShowTicket(true);
    onComplete(paymentData);
  };

  const addMixedPayment = (method: "cash" | "card" | "transfer") => {
    if (mixedRemaining <= 0) return;
    setMixedPayments([...mixedPayments, { method, amount: mixedRemaining }]);
  };

  const updateMixedAmount = (index: number, amount: number) => {
    const updated = [...mixedPayments];
    updated[index].amount = amount;
    setMixedPayments(updated);
  };

  const removeMixedPayment = (index: number) => {
    setMixedPayments(mixedPayments.filter((_, i) => i !== index));
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return <Banknote className="w-5 h-5" />;
      case "card":
        return <CreditCard className="w-5 h-5" />;
      case "transfer":
        return <ArrowRightLeft className="w-5 h-5" />;
      case "mixed":
        return <Wallet className="w-5 h-5" />;
    }
  };

  if (showTicket) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Venta completada" size="md">
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            ¡Venta exitosa!
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Ticket #{ticketNumber}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Pago</span>
              <span className="font-semibold">
                {paymentMethod === "cash"
                  ? formatCurrency(parseFloat(cashReceived))
                  : formatCurrency(total)}
              </span>
            </div>
            {change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cambio</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(change)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button variant="secondary" leftIcon={<Printer className="w-4 h-4" />}>
              Imprimir
            </Button>
            <Button variant="secondary" leftIcon={<Share2 className="w-4 h-4" />}>
              Compartir
            </Button>
            <Button onClick={onClose} variant="primary">
              Nueva venta
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cobrar" size="md">
      <div className="space-y-6">
        {/* Total display */}
        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total a pagar</p>
          <p className="text-4xl font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</p>
          <div className="flex justify-center gap-4 mt-2 text-sm text-slate-500">
            <span>Subtotal: {formatCurrency(subtotal)}</span>
            <span>IVA: {formatCurrency(tax)}</span>
          </div>
        </div>

        {/* Payment method selection */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
            Método de pago
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["cash", "card", "transfer", "mixed"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === method
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {getPaymentIcon(method)}
                <span className="font-medium capitalize">
                  {method === "cash" && "Efectivo"}
                  {method === "card" && "Tarjeta"}
                  {method === "transfer" && "Transferencia"}
                  {method === "mixed" && "Mixto"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cash payment */}
        {paymentMethod === "cash" && (
          <div className="space-y-4">
            <Input
              label="Efectivo recibido"
              type="number"
              placeholder="0.00"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              leftIcon={<Banknote className="w-4 h-4" />}
            />
            {change > 0 && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Cambio</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(change)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mixed payment */}
        {paymentMethod === "mixed" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Pagos parciales</span>
              <Badge variant={mixedRemaining === 0 ? "success" : "warning"}>
                {mixedRemaining === 0 ? "Completo" : `Faltan: ${formatCurrency(mixedRemaining)}`}
              </Badge>
            </div>

            {mixedPayments.map((payment, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
              >
                {getPaymentIcon(payment.method)}
                <span className="capitalize font-medium flex-1">{payment.method}</span>
                <input
                  type="number"
                  value={payment.amount}
                  onChange={(e) => updateMixedAmount(index, parseFloat(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-right"
                />
                <button
                  onClick={() => removeMixedPayment(index)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {mixedRemaining > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => addMixedPayment("cash")}
                  className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <Banknote className="w-4 h-4" />
                  Efectivo
                </button>
                <button
                  onClick={() => addMixedPayment("card")}
                  className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <CreditCard className="w-4 h-4" />
                  Tarjeta
                </button>
                <button
                  onClick={() => addMixedPayment("transfer")}
                  className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <ArrowRightLeft className="w-4 h-4" />
                  Transfer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete button */}
        <Button
          onClick={handleComplete}
          fullWidth
          size="lg"
          disabled={
            (paymentMethod === "cash" && (!cashReceived || parseFloat(cashReceived) < total)) ||
            (paymentMethod === "mixed" && mixedRemaining !== 0)
          }
        >
          Completar venta
        </Button>
      </div>
    </Modal>
  );
}
