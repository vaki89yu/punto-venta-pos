"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { CartItem, Customer, PaymentMethod } from "@/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { 
  Wallet, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  QrCode,
  Coins,
  ArrowRight,
  CheckCircle,
  Calculator,
  Split,
  User,
  Receipt,
  Printer,
  Share2,
  Send,
  X
} from "lucide-react";
import { ProfessionalTicket } from "./ProfessionalTicket";
import { QRCodeSVG } from "qrcode.react";

interface InnovativeCheckoutProps {
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

type PaymentStep = "method" | "details" | "qr" | "split" | "confirmation";

export function InnovativeCheckout({
  isOpen,
  onClose,
  total,
  subtotal,
  tax,
  items,
  customer,
  onComplete,
}: InnovativeCheckoutProps) {
  const [step, setStep] = useState<PaymentStep>("method");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [splitPayments, setSplitPayments] = useState<{ method: "cash" | "card" | "transfer"; amount: number }[]>([]);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [paymentDataState, setPaymentDataState] = useState<any>(null);

  const change = parseFloat(cashReceived) - total;
  const remainingForSplit = total - splitPayments.reduce((sum, p) => sum + p.amount, 0);

  useEffect(() => {
    if (isOpen) {
      setStep("method");
      setSelectedMethod("cash");
      setCashReceived("");
      setSplitPayments([]);
      setShowTicket(false);
    }
  }, [isOpen]);

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    if (method === "qr") {
      setStep("qr");
    } else if (method === "mixed") {
      setStep("split");
    } else {
      setStep("details");
    }
  };

  const handleComplete = () => {
    const paymentData = {
      method: selectedMethod,
      cashReceived: selectedMethod === "cash" ? parseFloat(cashReceived) : undefined,
      change: selectedMethod === "cash" && change > 0 ? change : undefined,
      paymentDetails:
        selectedMethod === "mixed"
          ? splitPayments.map(p => ({ ...p, reference: "" }))
          : [{ method: selectedMethod as "cash" | "card" | "transfer" | "qr", amount: total }],
    };

    const ticket = "TK" + Date.now().toString(36).toUpperCase().slice(-8);
    setTicketNumber(ticket);
    setPaymentDataState(paymentData);
    setShowTicket(true);
  };

  const handleTicketClose = () => {
    if (paymentDataState) {
      onComplete(paymentDataState);
    }
    onClose();
  };

  const addSplitPayment = (method: "cash" | "card" | "transfer") => {
    if (remainingForSplit <= 0) return;
    setSplitPayments([...splitPayments, { method, amount: remainingForSplit }]);
  };

  const updateSplitAmount = (index: number, amount: number) => {
    const updated = [...splitPayments];
    updated[index].amount = amount;
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
          total={total}
          subtotal={subtotal}
          tax={tax}
          items={items}
          customer={customer}
          paymentMethod={selectedMethod}
          cashReceived={selectedMethod === "cash" ? parseFloat(cashReceived) : undefined}
          change={change > 0 ? change : undefined}
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
          <AnimatePresence mode="wait">
            {step === "method" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-2 md:grid-cols-3 gap-4"
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
                  title="Tarjeta"
                  subtitle="Crédito o débito"
                  color="from-blue-500 to-blue-600"
                  onClick={() => handleMethodSelect("card")}
                />
                <PaymentOption
                  icon={<QrCode className="w-8 h-8" />}
                  title="QR Code"
                  subtitle="Escanea y paga"
                  color="from-purple-500 to-purple-600"
                  onClick={() => handleMethodSelect("qr")}
                />
                <PaymentOption
                  icon={<Smartphone className="w-8 h-8" />}
                  title="Transferencia"
                  subtitle="SPEI o transfer"
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
                <PaymentOption
                  icon={<User className="w-8 h-8" />}
                  title="Fiado"
                  subtitle="Venta a crédito"
                  color="from-rose-500 to-rose-600"
                  onClick={() => handleMethodSelect("cash")}
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
                      disabled={parseFloat(cashReceived) < total}
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
                    <div className="bg-slate-800 rounded-2xl p-8 text-center">
                      {selectedMethod === "card" ? (
                        <>
                          <CreditCard className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                          <p className="text-white text-lg font-semibold">Procesando pago con tarjeta</p>
                          <p className="text-slate-400 mt-2">Conecta la terminal y procesa el pago</p>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
                          <p className="text-white text-lg font-semibold">Transferencia bancaria</p>
                          <p className="text-slate-400 mt-2">Esperando confirmación de transferencia</p>
                        </>
                      )}
                    </div>
                    <Button onClick={handleComplete} fullWidth size="lg">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Confirmar Pago
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {step === "qr" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-6"
              >
                <button
                  onClick={() => setStep("method")}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Volver
                </button>

                <div className="bg-white p-8 rounded-2xl inline-block">
                  <QRCodeSVG
                    value={`PAYMENT:${total}:${Date.now()}`}
                    size={250}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div>
                  <p className="text-white text-lg font-semibold">Escanea para pagar</p>
                  <p className="text-slate-400 mt-2">Usa tu app bancaria para escanear el código</p>
                  <p className="text-2xl font-bold text-white mt-4">{formatCurrency(total)}</p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => setStep("method")} variant="secondary">
                    Cancelar
                  </Button>
                  <Button onClick={handleComplete}>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Pago
                  </Button>
                </div>
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

                {splitPayments.map((payment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {payment.method === "cash" && <Banknote className="w-5 h-5 text-emerald-400" />}
                      {payment.method === "card" && <CreditCard className="w-5 h-5 text-blue-400" />}
                      {payment.method === "transfer" && <Smartphone className="w-5 h-5 text-cyan-400" />}
                      <span className="text-white capitalize">{payment.method}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={payment.amount}
                        onChange={(e) => updateSplitAmount(index, parseFloat(e.target.value))}
                        className="w-24 bg-slate-700 text-white text-right px-3 py-2 rounded-lg"
                      />
                      <button
                        onClick={() => removeSplitPayment(index)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {remainingForSplit > 0 && (
                  <div className="grid grid-cols-3 gap-2">
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

                <Button
                  onClick={handleComplete}
                  disabled={remainingForSplit !== 0}
                  fullWidth
                  size="lg"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Completar Venta
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
