"use client";

import React, { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useSales } from "@/hooks/useSales";
import { Sale } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Search, Calendar, Receipt, Eye, Printer, XCircle, FileText } from "lucide-react";

function SalesContent() {
  const { showToast } = useToast();
  const { sales, getTodaySales, cancelSale } = useSales();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const filteredSales = sales.filter((sale) => {
    const matchesSearch = sale.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterPeriod === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const saleDate = new Date(sale.createdAt);
      return matchesSearch && saleDate >= today;
    }
    
    return matchesSearch;
  });

  const handleCancel = (id: string) => {
    if (confirm("¿Estás seguro de cancelar esta venta?")) {
      cancelSale(id);
      showToast("Venta cancelada", "info");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completada</Badge>;
      case "cancelled":
        return <Badge variant="danger">Cancelada</Badge>;
      case "refunded":
        return <Badge variant="warning">Reembolsada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ventas</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Historial de transacciones
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por número de ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex gap-2">
              {(["all", "today", "week", "month"] as const).map((period) => (
                <Button
                  key={period}
                  variant={filterPeriod === period ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFilterPeriod(period)}
                >
                  {period === "all" && "Todas"}
                  {period === "today" && "Hoy"}
                  {period === "week" && "Semana"}
                  {period === "month" && "Mes"}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Sales table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ticket</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Método</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900 dark:text-white">{sale.ticketNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-sm text-slate-600 dark:text-slate-400">
                        {sale.paymentMethod === "cash" && "Efectivo"}
                        {sale.paymentMethod === "card" && "Tarjeta"}
                        {sale.paymentMethod === "transfer" && "Transferencia"}
                        {sale.paymentMethod === "mixed" && "Mixto"}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(sale.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {sale.status === "completed" && (
                          <button
                            onClick={() => handleCancel(sale.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Sale detail modal */}
        <Modal
          isOpen={!!selectedSale}
          onClose={() => setSelectedSale(null)}
          title={`Ticket ${selectedSale?.ticketNumber}`}
          size="md"
        >
          {selectedSale && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Fecha</span>
                <span>{formatDateTime(selectedSale.createdAt)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="font-medium mb-3">Productos</h4>
                <div className="space-y-2">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantity}x Producto #{item.productId.slice(-4)}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Descuento</span>
                  <span>{formatCurrency(selectedSale.discount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">IVA</span>
                  <span>{formatCurrency(selectedSale.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedSale.total)}</span>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" fullWidth leftIcon={<Printer className="w-4 h-4" />}>
                  Imprimir
                </Button>
                <Button variant="primary" fullWidth onClick={() => setSelectedSale(null)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

export default function SalesPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <SalesContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
