"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { CartItem, Customer, PaymentMethod } from "@/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CreditCard, Smartphone, Banknote, ArrowRight, CheckCircle, Split, X } from "lucide-react";
import { ProfessionalTicket } from "./ProfessionalTicket";

type CheckoutMethod = Exclude<PaymentMethod, "qr">;

interface InnovativeCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  items: CartItem[];
  customer: Customer | null;
  onComplete: (paymentData: {
    method: CheckoutMethod;
    ticketNumber: string;
    cashReceived?: number;
    change?: number;
    paymentDetails: { method: "cash" | "card" | "transfer"; amount: number; reference?: string }[];
  }) => boolean | Promise<boolean>;
}

type PaymentStep = "method" | "details" | "split";

type TicketSnapshot = {
  items: CartItem[];
  customer: Customer | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: CheckoutMethod;
  cashReceived?: number;
  change?: number;
};

export function InnovativeCheckout({
  isOpen,
  onClose,
  total,
  subtotal,
  discount,
  tax,
  items,
  customer,
  onComplete,
}: InnovativeCheckoutProps) {
  const [step, setStep] = useState<PaymentStep>("method");
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod>("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [externalReference, setExternalReference] = useState("");
  const [externalPaymentConfirmed, setExternalPaymentConfirmed] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ method: "cash" | "card" | "transfer"; amount: number; reference?: string; confirmed?: boolean }[]>([]);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketSnapshot, setTicketSnapshot] = useState<TicketSnapshot | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attemptTicket = useRef("");

  const change = parseFloat(cashReceived) - total;
  const remainingForSplit = Math.round((total - splitPayments.reduce((sum, p) => sum + p.amount, 0) + Number.EPSILON) * 100) / 100;

  useEffect(() => {
    if (isOpen) {
      setStep("method");
      setSelectedMethod("cash");
      setCashReceived("");
      setExternalReference("");
      setExternalPaymentConfirmed(false);
      setSplitPayments([]);
      setShowTicket(false);
      setTicketSnapshot(null);
      setTicketNumber("");
      setCheckoutError("");
      setIsSubmitting(false);
      attemptTicket.current = "";
    }
  }, [isOpen]);

  const handleMethodSelect = (method: CheckoutMethod) => {
    setSelectedMethod(method);
    setExternalReference("");
    setExternalPaymentConfirmed(false);
    if (method === "mixed") setStep("split");
    else setStep("details");
  };

  const handleComplete = async () => {
    if (isSubmitting) return;
    setCheckoutError("");
    setIsSubmitting(true);
    const ticket = attemptTicket.current || `TK-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    attemptTicket.current = ticket;
    const paymentData = {
      method: selectedMethod,
      ticketNumber: ticket,
      cashReceived: selectedMethod === "cash" ? Number(cashReceived) : selectedMethod === "mixed" ? splitPayments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amount, 0) : undefined,
      change: selectedMethod === "cash" && change > 0 ? change : undefined,
      paymentDetails:
        selectedMethod === "mixed"
          ? splitPayments.map(({ method, amount, reference }) => ({ method, amount, reference }))
          : [{ method: selectedMethod as "cash" | "card" | "transfer", amount: total, reference: selectedMethod === "cash" ? undefined : externalReference.trim() || undefined }],
    };

    try {
      const saved = await onComplete(paymentData);
      if (!saved) {
        setCheckoutError("No se pudo registrar la venta. Revisa la conexión, la caja abierta y el stock antes de reintentar.");
        return;
      }
      setTicketNumber(ticket);
      setTicketSnapshot({ items, customer, subtotal, discount, tax, total, paymentMethod: selectedMethod, cashReceived: paymentData.cashReceived, change: selectedMethod === "cash" && change > 0 ? change : undefined });
      setShowTicket(true);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "No se pudo registrar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketClose = () => onClose();

  const addSplitPayment = (method: "cash" | "card" | "transfer") => {
    if (remainingForSplit <= 0) return;
    setSplitPayments([...splitPayments, { method, amount: remainingForSplit }]);
  };

  const updateSplitAmount = (index: number, amount: number) => {
    const updated = [...splitPayments];
    updated[index].amount = Number.isFinite(amount) ? Math.max(0, Math.min(amount, total)) : 0;
    setSplitPayments(updated);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  if (showTicket) {
    return (
      <Modal isOpen={isOpen} onClose={handleTicketClose} title="" size="md" hideCloseButton>
        <ProfessionalTicket
          ticketNumber={ticketNumber}
          total={ticketSnapshot?.total ?? total}
          subtotal={ticketSnapshot?.subtotal ?? subtotal}
          discount={ticketSnapshot?.discount ?? discount}
          tax={ticketSnapshot?.tax ?? tax}
          items={ticketSnapshot?.items ?? items}
          customer={ticketSnapshot?.customer ?? customer}
          paymentMethod={ticketSnapshot?.paymentMethod ?? selectedMethod}
          cashReceived={ticketSnapshot?.cashReceived}
          change={ticketSnapshot?.change}
          onClose={handleTicketClose}
        />
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg" hideCloseButton>
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Cobrar</h2>
              <p className="text-blue-100">Selecciona el método de pago</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Total a pagar</p>
              <p className="text-4xl font-bold text-white">{formatCurrency(total)}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {checkoutError && (
            <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {checkoutError}
            </div>
          )}
          <AnimatePresence mode="wait">
            {step === "method" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <PaymentOption
                  icon={<Banknote className="w-8 h-8" />}
                  title="Efectivo"
                  subtitle="Pago en efectivo"
                  color="from-emerald-500 to-emerald-600"
                  onClick={() => handleMethodSelect("cash")}
                />
                <PaymentOption
                  icon={<CreditCard className="w-8 h-8" />}
                  title="Tarjeta externa"
                  subtitle="Confirmar en terminal"
                  color="from-blue-500 to-blue-600"
                  onClick={() => handleMethodSelect("card")}
                />
                <PaymentOption
                  icon={<Smartphone className="w-8 h-8" />}
                  title="Transferencia"
                  subtitle="Confirmar en app bancaria"
                  color="from-cyan-500 to-cyan-600"
                  onClick={() => handleMethodSelect("transfer")}
                />
                <PaymentOption
                  icon={<Split className="w-8 h-8" />}
                  title="Dividido"
                  subtitle="Varios métodos"
                  color="from-amber-500 to-amber-600"
                  onClick={() => handleMethodSelect("mixed")}
                />
              </motion.div>
            )}

            {step === "details" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <button
                  onClick={() => setStep("method")}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Volver
                </button>

                {selectedMethod === "cash" && (
                  <div className="space-y-4">
                    <div className="bg-slate-800 rounded-2xl p-6">
                      <label className="text-slate-400 text-sm">Efectivo recibido</label>
                      <div className="relative mt-2">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-slate-500">$</span>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="w-full bg-slate-700 text-white text-4xl font-bold py-4 pl-12 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Quick amount buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      {[20, 50, 100, 200, 500, 1000].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setCashReceived(amount.toString())}
                          className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
                        >
                          ${amount}
                        </button>
                      ))}
                      <button
                        onClick={() => setCashReceived(Math.ceil(total / 10) * 10 + "")}
                        className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-colors"
                      >
                        Exacto
                      </button>
                    </div>

                    {parseFloat(cashReceived) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-6 rounded-2xl ${change >= 0 ? 'bg-emerald-500/20 border-2 border-emerald-500' : 'bg-red-500/20 border-2 border-red-500'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {change >= 0 ? 'Cambio' : 'Faltante'}
                          </span>
                          <span className={`text-3xl font-bold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(Math.abs(change))}
                          </span>
                        </div>
                      </motion.div>
                    )}

                    <Button
                      onClick={handleComplete}
                      disabled={!Number.isFinite(Number(cashReceived)) || Number(cashReceived) < total || isSubmitting}
                      isLoading={isSubmitting}
                      fullWidth
                      size="lg"
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Completar Venta
                    </Button>
                  </div>
                )}

                {(selectedMethod === "card" || selectedMethod === "transfer") && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
                      <div className="flex items-center gap-3">
                        {selectedMethod === "card" ? <CreditCard className="h-8 w-8 text-blue-300" /> : <Smartphone className="h-8 w-8 text-cyan-300" />}
                        <div><p className="font-semibold text-white">{selectedMethod === "card" ? "Cobro en terminal externa" : "Transferencia bancaria"}</p><p className="text-sm text-amber-100">El POS no procesa ni valida este pago. Confirma el abono en la terminal o app bancaria antes de registrarlo.</p></div>
                      </div>
                    </div>
                    <label className="block text-sm font-medium text-slate-200">Referencia o autorización (opcional)
                      <input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} maxLength={255} placeholder="Folio de terminal o transferencia" className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder:text-slate-400" />
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-white"><input type="checkbox" checked={externalPaymentConfirmed} onChange={(event) => setExternalPaymentConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-500" /><span>Confirmo que el pago fue aprobado y recibido fuera del POS.</span></label>
                    <Button onClick={handleComplete} disabled={!externalPaymentConfirmed || isSubmitting} isLoading={isSubmitting} fullWidth size="lg">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Registrar pago ya verificado
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {step === "split" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <button
                  onClick={() => setStep("method")}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Volver
                </button>

                <div className="bg-slate-800 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400">Total</span>
                    <span className="text-2xl font-bold text-white">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400">Pagado</span>
                    <span className="text-xl font-semibold text-emerald-400">
                      {formatCurrency(splitPayments.reduce((sum, p) => sum + p.amount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                    <span className="text-slate-400">Restante</span>
                    <span className={`text-xl font-bold ${remainingForSplit === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {formatCurrency(remainingForSplit)}
                    </span>
                  </div>
                </div>

                <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">Tarjeta y transferencia no se procesan en este POS; confirma cada cargo externo en la terminal o app bancaria.</p>

                {splitPayments.map((payment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 rounded-xl bg-slate-800 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {payment.method === "cash" && <Banknote className="w-5 h-5 text-emerald-400" />}
                        {payment.method === "card" && <CreditCard className="w-5 h-5 text-blue-400" />}
                        {payment.method === "transfer" && <Smartphone className="w-5 h-5 text-cyan-400" />}
                        <span className="text-white capitalize">{payment.method}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="number" min="0" step="0.01" value={payment.amount} onChange={(e) => updateSplitAmount(index, Number(e.target.value))} aria-label={`Importe ${payment.method}`} className="w-28 rounded-lg bg-slate-700 px-3 py-2 text-right text-white" />
                        <button onClick={() => removeSplitPayment(index)} aria-label="Quitar forma de pago" className="rounded-lg p-2 text-red-400 hover:bg-red-500/20"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {payment.method !== "cash" && <div className="space-y-2 border-t border-slate-700 pt-3"><input value={payment.reference || ""} onChange={(event) => setSplitPayments((current) => current.map((entry, i) => i === index ? { ...entry, reference: event.target.value } : entry))} maxLength={255} placeholder="Referencia / autorización (opcional)" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400" /><label className="flex cursor-pointer items-start gap-2 text-xs text-amber-100"><input type="checkbox" checked={Boolean(payment.confirmed)} onChange={(event) => setSplitPayments((current) => current.map((entry, i) => i === index ? { ...entry, confirmed: event.target.checked } : entry))} className="mt-0.5 accent-emerald-500" /><span>Confirmo que este pago fue aprobado fuera del POS.</span></label></div>}
                  </motion.div>
                ))}

                {remainingForSplit > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      onClick={() => addSplitPayment("cash")}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Banknote className="w-4 h-4" />
                      Efectivo
                    </button>
                    <button
                      onClick={() => addSplitPayment("card")}
                      className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      Tarjeta
                    </button>
                    <button
                      onClick={() => addSplitPayment("transfer")}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Smartphone className="w-4 h-4" />
                      Transfer
                    </button>
                  </div>
                )}

                <Button onClick={handleComplete} disabled={Math.abs(remainingForSplit) > 0.009 || splitPayments.length === 0 || splitPayments.some((payment) => payment.method !== "cash" && !payment.confirmed) || isSubmitting} isLoading={isSubmitting} fullWidth size="lg">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Registrar venta (pagos confirmados)
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}

function PaymentOption({
  icon,
  title,
  subtitle,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden bg-gradient-to-br ${color} p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all group`}
    >
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="mb-4">{icon}</div>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-white/80 text-sm">{subtitle}</p>
      </div>
    </motion.button>
  );
}
