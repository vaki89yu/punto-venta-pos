"use client";

import React, { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { STORAGE_KEYS } from "@/data/seed";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Minus,
  Lock,
  Unlock,
  Receipt,
} from "lucide-react";

interface CashRegister {
  id: string;
  userId: string;
  userName: string;
  openingAmount: number;
  closingAmount?: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  cashIn: number;
  cashOut: number;
  openedAt: Date;
  closedAt?: Date;
  status: "open" | "closed";
}

function CashContent() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CASH_REGISTER);
    if (stored) {
      setCashRegister(JSON.parse(stored));
    }
  }, []);

  const handleOpen = () => {
    if (!user) return;
    const newRegister: CashRegister = {
      id: Math.random().toString(36).substring(2, 9),
      userId: user.id,
      userName: user.name,
      openingAmount: parseFloat(amount),
      cashSales: 0,
      cardSales: 0,
      transferSales: 0,
      cashIn: 0,
      cashOut: 0,
      openedAt: new Date(),
      status: "open",
    };
    setCashRegister(newRegister);
    localStorage.setItem(STORAGE_KEYS.CASH_REGISTER, JSON.stringify(newRegister));
    setShowOpenModal(false);
    setAmount("");
    showToast("Caja abierta exitosamente", "success");
  };

  const handleClose = () => {
    if (!cashRegister) return;
    const closed = {
      ...cashRegister,
      closingAmount: parseFloat(amount),
      closedAt: new Date(),
      status: "closed" as const,
    };
    setCashRegister(closed);
    localStorage.setItem(STORAGE_KEYS.CASH_REGISTER, JSON.stringify(closed));
    setShowCloseModal(false);
    setAmount("");
    showToast("Caja cerrada exitosamente", "success");
    setTimeout(() => printCashCut(closed), 300);
  };

  const printCashCut = (reg: CashRegister) => {
    const counted = reg.closingAmount ?? 0;
    const expected = reg.openingAmount + reg.cashSales + reg.cashIn - reg.cashOut;
    const diff = counted - expected;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Corte de Caja</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:80mm;margin:0 auto;padding:10px;color:#000}
        h1{font-size:16px;text-align:center;margin:0}
        h2{font-size:13px;text-align:center;margin:0 0 8px;color:#059669}
        .row{display:flex;justify-content:space-between;font-size:11px;padding:3px 0}
        .sep{border-top:1px dashed #999;margin:8px 0}
        .total{font-size:14px;font-weight:bold;border-top:2px solid #000;padding-top:6px;margin-top:6px}
        .center{text-align:center;font-size:10px;color:#555}
        .diff{font-weight:bold;color:${diff === 0 ? "#059669" : diff > 0 ? "#2563eb" : "#dc2626"}}
      </style></head><body>
        <h1>ABARROTES</h1><h2>LA ESQUINA</h2>
        <div class="center">CORTE DE CAJA</div>
        <div class="sep"></div>
        <div class="row"><span>Cajero:</span><b>${reg.userName}</b></div>
        <div class="row"><span>Apertura:</span><span>${new Date(reg.openedAt).toLocaleString("es-MX")}</span></div>
        <div class="row"><span>Cierre:</span><span>${new Date().toLocaleString("es-MX")}</span></div>
        <div class="sep"></div>
        <div class="row"><span>Fondo inicial</span><b>${formatCurrency(reg.openingAmount)}</b></div>
        <div class="row"><span>Ventas efectivo</span><b>${formatCurrency(reg.cashSales)}</b></div>
        <div class="row"><span>Ventas tarjeta</span><b>${formatCurrency(reg.cardSales)}</b></div>
        <div class="row"><span>Transferencias</span><b>${formatCurrency(reg.transferSales)}</b></div>
        <div class="row"><span>Entradas</span><b>+${formatCurrency(reg.cashIn)}</b></div>
        <div class="row"><span>Salidas</span><b>-${formatCurrency(reg.cashOut)}</b></div>
        <div class="sep"></div>
        <div class="row total"><span>Efectivo esperado</span><span>${formatCurrency(expected)}</span></div>
        <div class="row"><span>Efectivo contado</span><b>${formatCurrency(counted)}</b></div>
        <div class="row"><span>Diferencia</span><span class="diff">${formatCurrency(diff)}</span></div>
        <div class="sep"></div>
        <div class="center">Firma: _____________________</div>
        <br/><div class="center">Documento generado automáticamente</div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400)}</script>
      </body></html>
    `);
    win.document.close();
  };

  const handleMovement = () => {
    if (!cashRegister) return;
    const updated = {
      ...cashRegister,
      cashIn: movementType === "in" ? cashRegister.cashIn + parseFloat(amount) : cashRegister.cashIn,
      cashOut: movementType === "out" ? cashRegister.cashOut + parseFloat(amount) : cashRegister.cashOut,
    };
    setCashRegister(updated);
    localStorage.setItem(STORAGE_KEYS.CASH_REGISTER, JSON.stringify(updated));
    setShowMovementModal(false);
    setAmount("");
    showToast(`Movimiento de ${movementType === "in" ? "entrada" : "salida"} registrado`, "success");
  };

  const expectedCash = cashRegister
    ? cashRegister.openingAmount + cashRegister.cashSales + cashRegister.cashIn - cashRegister.cashOut
    : 0;

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Control de Caja</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Gestiona tu efectivo y movimientos
            </p>
          </div>
          {cashRegister?.status === "open" ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => { setMovementType("in"); setShowMovementModal(true); }}
                leftIcon={<Plus className="w-5 h-5" />}
              >
                Entrada
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setMovementType("out"); setShowMovementModal(true); }}
                leftIcon={<Minus className="w-5 h-5" />}
              >
                Salida
              </Button>
              <Button
                variant="secondary"
                onClick={() => cashRegister && printCashCut(cashRegister)}
                leftIcon={<Receipt className="w-5 h-5" />}
              >
                Corte parcial
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowCloseModal(true)}
                leftIcon={<Lock className="w-5 h-5" />}
              >
                Cerrar caja
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowOpenModal(true)}
              leftIcon={<Unlock className="w-5 h-5" />}
            >
              Abrir caja
            </Button>
          )}
        </div>

        {cashRegister?.status === "open" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                      <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Efectivo esperado</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(expectedCash)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Ventas en efectivo</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(cashRegister.cashSales)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                      <Plus className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Entradas</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(cashRegister.cashIn)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                      <Minus className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Salidas</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(cashRegister.cashOut)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader title="Detalle de ventas" />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-slate-600 dark:text-slate-400">Ventas en efectivo</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(cashRegister.cashSales)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-slate-600 dark:text-slate-400">Ventas con tarjeta</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(cashRegister.cardSales)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-slate-600 dark:text-slate-400">Transferencias</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(cashRegister.transferSales)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-900 dark:text-white">Total vendido</span>
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(cashRegister.cashSales + cashRegister.cardSales + cashRegister.transferSales)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Caja cerrada
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Abre la caja para comenzar a registrar ventas
              </p>
              <Button onClick={() => setShowOpenModal(true)} leftIcon={<Unlock className="w-5 h-5" />}>
                Abrir caja
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Open modal */}
        <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Abrir caja" size="sm">
          <div className="space-y-4">
            <Input
              label="Fondo inicial"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftIcon={<DollarSign className="w-4 h-4" />}
              required
            />
            <Button onClick={handleOpen} fullWidth disabled={!amount}>
              Abrir caja
            </Button>
          </div>
        </Modal>

        {/* Close modal */}
        <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Cerrar caja" size="sm">
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-sm text-slate-500">Efectivo esperado</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(expectedCash)}</p>
            </div>
            <Input
              label="Efectivo contado"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftIcon={<DollarSign className="w-4 h-4" />}
              required
            />
            {amount && (
              <div className={`p-3 rounded-xl ${
                parseFloat(amount) === expectedCash
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700"
              }`}>
                <p className="font-medium">
                  Diferencia: {formatCurrency(parseFloat(amount) - expectedCash)}
                </p>
              </div>
            )}
            <Button onClick={handleClose} fullWidth disabled={!amount}>
              Cerrar caja
            </Button>
          </div>
        </Modal>

        {/* Movement modal */}
        <Modal isOpen={showMovementModal} onClose={() => setShowMovementModal(false)} title={`Registrar ${movementType === "in" ? "entrada" : "salida"}`} size="sm">
          <div className="space-y-4">
            <Input
              label="Monto"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftIcon={<DollarSign className="w-4 h-4" />}
              required
            />
            <Button onClick={handleMovement} fullWidth disabled={!amount}>
              Registrar
            </Button>
          </div>
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

export default function CashPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <CashContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
