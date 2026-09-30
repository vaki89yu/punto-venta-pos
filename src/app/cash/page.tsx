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
  difference?: number;
  status: "open" | "closed";
}

function CashContent() {
  const { showToast } = useToast();
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/cash-register", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as { cashRegister?: (Omit<CashRegister, "openedAt" | "closedAt"> & { openedAt: string; closedAt?: string }) | null; error?: { message?: string } } | null;
        if (!response.ok) throw new Error(result?.error?.message || "No se pudo cargar la caja.");
        if (!active) return;
        setCashRegister(result?.cashRegister ? { ...result.cashRegister, openedAt: new Date(result.cashRegister.openedAt), closedAt: result.cashRegister.closedAt ? new Date(result.cashRegister.closedAt) : undefined } : null);
        setLoadError("");
      })
      .catch((error: unknown) => { if (active) { setLoadError(error instanceof Error ? error.message : "No se pudo cargar la caja."); showToast(error instanceof Error ? error.message : "No se pudo cargar la caja.", "error"); } })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  const submitRegisterAction = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/cash-register", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null) as { cashRegister?: (Omit<CashRegister, "openedAt" | "closedAt"> & { openedAt: string; closedAt?: string }) | null; error?: { message?: string } } | null;
    if (!response.ok || !result?.cashRegister) throw new Error(result?.error?.message || "No se pudo actualizar la caja.");
    const updated = { ...result.cashRegister, openedAt: new Date(result.cashRegister.openedAt), closedAt: result.cashRegister.closedAt ? new Date(result.cashRegister.closedAt) : undefined };
    setCashRegister(updated);
    setLoadError("");
    return updated;
  };

  const handleOpen = async () => {
    const openingAmount = Number(amount);
    if (!Number.isFinite(openingAmount) || openingAmount < 0) return showToast("Captura un fondo inicial válido.", "warning");
    setIsSaving(true);
    try {
      await submitRegisterAction({ action: "open", openingAmount });
      setShowOpenModal(false); setAmount(""); showToast("Caja abierta y registrada en PostgreSQL", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo abrir la caja.", "error"); }
    finally { setIsSaving(false); }
  };

  const handleClose = async () => {
    if (!cashRegister) return;
    const closingAmount = Number(amount);
    if (!Number.isFinite(closingAmount) || closingAmount < 0) return showToast("Captura el efectivo contado.", "warning");
    setIsSaving(true);
    try {
      const closed = await submitRegisterAction({ action: "close", registerId: cashRegister.id, closingAmount });
      setShowCloseModal(false); setAmount(""); showToast("Caja cerrada y corte guardado en PostgreSQL", "success");
      setTimeout(() => printCashCut(closed), 300);
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo cerrar la caja.", "error"); }
    finally { setIsSaving(false); }
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

  const handleMovement = async () => {
    if (!cashRegister) return;
    if (!movementReason.trim()) return showToast("Describe el motivo del movimiento de efectivo", "warning");
    const movementAmount = Number(amount);
    if (!Number.isFinite(movementAmount) || movementAmount <= 0) return showToast("Captura un monto válido mayor a cero.", "warning");
    setIsSaving(true);
    try {
      await submitRegisterAction({ action: "movement", registerId: cashRegister.id, type: movementType, amount: movementAmount, reason: movementReason.trim() });
      setShowMovementModal(false); setAmount(""); setMovementReason(""); showToast(`Movimiento de ${movementType === "in" ? "entrada" : "salida"} guardado en PostgreSQL`, "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo registrar el movimiento.", "error"); }
    finally { setIsSaving(false); }
  };

  const expectedCash = cashRegister
    ? cashRegister.openingAmount + cashRegister.cashSales + cashRegister.cashIn - cashRegister.cashOut
    : 0;

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {isLoading && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Consultando el estado de caja en el servidor…</p>}
        {loadError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{loadError}</p>}
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
              disabled={isLoading || isSaving || Boolean(loadError)}
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
              <Button onClick={() => setShowOpenModal(true)} disabled={isLoading || isSaving || Boolean(loadError)} leftIcon={<Unlock className="w-5 h-5" />}>
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
            <Button onClick={handleOpen} fullWidth disabled={!amount || isSaving} isLoading={isSaving}>
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
            <Button onClick={handleClose} fullWidth disabled={!amount || isSaving} isLoading={isSaving}>
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
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftIcon={<DollarSign className="w-4 h-4" />}
              required
            />
            <Input
              label="Motivo obligatorio"
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              placeholder="Ej. Pago a proveedor, retiro para cambio..."
              required
            />
            <Button onClick={handleMovement} fullWidth disabled={!amount || !movementReason.trim() || isSaving} isLoading={isSaving}>
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
