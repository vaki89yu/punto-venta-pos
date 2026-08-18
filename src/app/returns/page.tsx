"use client";

import React, { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useSales } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { useReturns } from "@/hooks/useReturns";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Sale } from "@/types";
import { Search, RotateCcw, Package, CheckCircle, AlertCircle, Receipt } from "lucide-react";

function ReturnsContent() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { sales } = useSales();
  const { updateProduct, getProductById } = useProducts();
  const { returns, createReturn, getTotalRefunded } = useReturns();

  const [searchTicket, setSearchTicket] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [showModal, setShowModal] = useState(false);

  const searchResults = sales.filter(
    s => s.ticketNumber.toLowerCase().includes(searchTicket.toLowerCase()) && s.status === "completed"
  );

  const handleSelectSale = (sale: Sale) => {
    setSelectedSale(sale);
    const initial: Record<string, number> = {};
    sale.items.forEach(item => { initial[item.productId] = 0; });
    setReturnQuantities(initial);
    setShowModal(true);
  };

  const handleQuantityChange = (productId: string, value: number, max: number) => {
    setReturnQuantities(prev => ({ ...prev, [productId]: Math.min(Math.max(0, value), max) }));
  };

  const calculateRefund = () => {
    if (!selectedSale) return 0;
    return selectedSale.items.reduce((sum, item) => {
      const qty = returnQuantities[item.productId] || 0;
      return sum + qty * item.price;
    }, 0);
  };

  const handleConfirmReturn = () => {
    if (!selectedSale || !user) return;

    const itemsToReturn = selectedSale.items
      .filter(item => (returnQuantities[item.productId] || 0) > 0)
      .map(item => {
        const product = getProductById(item.productId);
        const qty = returnQuantities[item.productId];
        return {
          productId: item.productId,
          productName: product?.name || "Producto",
          quantityReturned: qty,
          price: item.price,
          refundAmount: qty * item.price,
        };
      });

    if (itemsToReturn.length === 0) {
      showToast("Selecciona al menos un producto para devolver", "warning");
      return;
    }

    if (!reason.trim()) {
      showToast("Ingresa el motivo de la devolución", "warning");
      return;
    }

    // Update inventory
    itemsToReturn.forEach(item => {
      const product = getProductById(item.productId);
      if (product) {
        updateProduct(item.productId, { stock: product.stock + item.quantityReturned });
      }
    });

    createReturn({
      saleId: selectedSale.id,
      ticketNumber: selectedSale.ticketNumber,
      items: itemsToReturn,
      totalRefund: calculateRefund(),
      reason,
      processedBy: user.id,
    });

    showToast("Devolución procesada exitosamente", "success");
    setShowModal(false);
    setSelectedSale(null);
    setReason("");
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Devoluciones</h1>
          <p className="text-slate-500">Gestiona devoluciones y reembolsos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Total Devoluciones</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{returns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Total Reembolsado</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(getTotalRefunded())}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Este Mes</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {returns.filter(r => new Date(r.createdAt).getMonth() === new Date().getMonth()).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Buscar venta */}
        <Card>
          <CardHeader title="Buscar Venta para Devolución" />
          <CardContent>
            <Input
              placeholder="Buscar por número de ticket..."
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
            {searchTicket && (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="text-center py-4 text-slate-400">No se encontraron ventas</p>
                ) : (
                  searchResults.slice(0, 10).map(sale => (
                    <button
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Receipt className="w-5 h-5 text-slate-400" />
                        <div className="text-left">
                          <p className="font-mono font-semibold text-sm">{sale.ticketNumber}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(sale.createdAt)}</p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-800">{formatCurrency(sale.total)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historial de devoluciones */}
        <Card>
          <CardHeader title="Historial de Devoluciones" />
          <CardContent>
            {returns.length === 0 ? (
              <div className="text-center py-8">
                <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400">No hay devoluciones registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {returns.map(ret => (
                  <div key={ret.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono font-semibold text-sm">{ret.ticketNumber}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(ret.createdAt)}</p>
                      </div>
                      <Badge variant="success">Aprobada</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">Motivo: {ret.reason}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{ret.items.length} producto(s) devuelto(s)</span>
                      <span className="font-bold text-rose-600">-{formatCurrency(ret.totalRefund)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de devolución */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Procesar Devolución" size="lg">
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500">Ticket: <span className="font-mono font-semibold">{selectedSale.ticketNumber}</span></p>
                <p className="text-sm text-slate-500">Fecha: {formatDateTime(selectedSale.createdAt)}</p>
              </div>

              <div>
                <p className="font-medium text-slate-700 mb-2">Selecciona productos a devolver</p>
                <div className="space-y-2">
                  {selectedSale.items.map(item => {
                    const product = getProductById(item.productId);
                    return (
                      <div key={item.productId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product?.name || "Producto"}</p>
                          <p className="text-xs text-slate-500">
                            Comprado: {item.quantity} x {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(item.productId, (returnQuantities[item.productId] || 0) - 1, item.quantity)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                          >-</button>
                          <span className="w-8 text-center font-semibold">{returnQuantities[item.productId] || 0}</span>
                          <button
                            onClick={() => handleQuantityChange(item.productId, (returnQuantities[item.productId] || 0) + 1, item.quantity)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Motivo de la devolución"
                placeholder="Ej: Producto defectuoso, cliente cambió de opinión..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-rose-700">Total a Reembolsar</span>
                  <span className="text-2xl font-bold text-rose-600">{formatCurrency(calculateRefund())}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" fullWidth onClick={handleConfirmReturn} leftIcon={<CheckCircle className="w-4 h-4" />}>
                  Confirmar Devolución
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

export default function ReturnsPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ReturnsContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
