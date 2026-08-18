"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSales } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToExcel, exportToCSV, exportToPDF } from "@/lib/exportUtils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  FileSpreadsheet, FileText, Printer, Download, TrendingUp,
  DollarSign, Package, Users, Calendar, ChevronDown, BarChart3,
} from "lucide-react";
import { STORAGE_KEYS } from "@/data/seed";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f43f5e"];

type ReportType = "sales" | "profit" | "inventory" | "topProducts" | "byCategory" | "byPayment" | "byEmployee";

function ReportsContent() {
  const { showToast } = useToast();
  const { sales } = useSales();
  const { products } = useProducts();
  const [categories, setCategories] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<ReportType>("sales");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (stored) setCategories(JSON.parse(stored));
  }, []);

  const filteredSales = useMemo(() => {
    const now = new Date();
    let startDate = new Date(0);

    if (dateRange === "today") {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (dateRange === "week") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (dateRange === "month") {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    return sales.filter(s => new Date(s.createdAt) >= startDate && s.status === "completed");
  }, [sales, dateRange]);

  const salesReportData = useMemo(() => {
    return filteredSales.map(s => ({
      Ticket: s.ticketNumber,
      Fecha: formatDate(s.createdAt),
      Cliente: s.customerId || "General",
      Subtotal: s.subtotal.toFixed(2),
      IVA: s.tax.toFixed(2),
      Total: s.total.toFixed(2),
      Metodo: s.paymentMethod,
      Estado: s.status,
    }));
  }, [filteredSales]);

  const profitData = useMemo(() => {
    return products.map(p => {
      const profit = p.salePrice - p.purchasePrice;
      const margin = ((profit / p.salePrice) * 100).toFixed(1);
      return {
        Producto: p.name,
        SKU: p.sku,
        PrecioCompra: p.purchasePrice.toFixed(2),
        PrecioVenta: p.salePrice.toFixed(2),
        Ganancia: profit.toFixed(2),
        MargenPct: margin,
        Stock: p.stock,
      };
    }).sort((a, b) => parseFloat(b.Ganancia) - parseFloat(a.Ganancia));
  }, [products]);

  const inventoryData = useMemo(() => {
    return products.map(p => ({
      Producto: p.name,
      SKU: p.sku,
      Categoria: categories.find(c => c.id === p.categoryId)?.name || "N/A",
      Stock: p.stock,
      StockMinimo: p.minStock,
      Estado: p.stock === 0 ? "Agotado" : p.stock <= p.minStock ? "Stock Bajo" : "Disponible",
      ValorInventario: (p.stock * p.purchasePrice).toFixed(2),
    }));
  }, [products, categories]);

  const totalInventoryValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock * p.purchasePrice, 0);
  }, [products]);

  const topProductsData = useMemo(() => {
    const productSales: Record<string, { name: string; qty: number; total: number }> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const name = product?.name || "Desconocido";
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name, qty: 0, total: 0 };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].total += item.total;
      });
    });
    return Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [filteredSales, products]);

  const categoryData = useMemo(() => {
    const catSales: Record<string, number> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const cat = categories.find(c => c.id === product?.categoryId);
        const catName = cat?.name || "Sin categoría";
        catSales[catName] = (catSales[catName] || 0) + item.total;
      });
    });
    return Object.entries(catSales).map(([name, value]) => ({ name, value }));
  }, [filteredSales, products, categories]);

  const paymentMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    filteredSales.forEach(sale => {
      methods[sale.paymentMethod] = (methods[sale.paymentMethod] || 0) + sale.total;
    });
    const labels: Record<string, string> = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", mixed: "Mixto", qr: "QR" };
    return Object.entries(methods).map(([method, value]) => ({ name: labels[method] || method, value }));
  }, [filteredSales]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = filteredSales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return itemSum;
      return itemSum + (product.salePrice - product.purchasePrice) * item.quantity;
    }, 0);
  }, 0);

  const reportTabs: { id: ReportType; label: string; icon: any }[] = [
    { id: "sales", label: "Ventas", icon: DollarSign },
    { id: "profit", label: "Ganancias", icon: TrendingUp },
    { id: "inventory", label: "Inventario", icon: Package },
    { id: "topProducts", label: "Más Vendidos", icon: BarChart3 },
    { id: "byCategory", label: "Por Categoría", icon: BarChart3 },
    { id: "byPayment", label: "Métodos de Pago", icon: DollarSign },
  ];

  const handleExportExcel = () => {
    let data: any[] = [];
    let filename = "reporte";

    switch (activeReport) {
      case "sales": data = salesReportData; filename = "reporte-ventas"; break;
      case "profit": data = profitData; filename = "reporte-ganancias"; break;
      case "inventory": data = inventoryData; filename = "reporte-inventario"; break;
      case "topProducts": data = topProductsData; filename = "reporte-mas-vendidos"; break;
      default: data = salesReportData;
    }

    exportToExcel(data, filename);
    showToast("Reporte exportado a Excel", "success");
  };

  const handleExportCSV = () => {
    let data: any[] = [];
    let filename = "reporte";

    switch (activeReport) {
      case "sales": data = salesReportData; filename = "reporte-ventas"; break;
      case "profit": data = profitData; filename = "reporte-ganancias"; break;
      case "inventory": data = inventoryData; filename = "reporte-inventario"; break;
      default: data = salesReportData;
    }

    exportToCSV(data, filename);
    showToast("Reporte exportado a CSV", "success");
  };

  const handleExportPDF = () => {
    if (activeReport === "sales") {
      exportToPDF(
        "Reporte de Ventas",
        ["Ticket", "Fecha", "Total", "Método", "Estado"],
        filteredSales.map(s => [s.ticketNumber, formatDate(s.createdAt), formatCurrency(s.total), s.paymentMethod, s.status]),
        "reporte-ventas",
        [
          { label: "Total de ventas", value: formatCurrency(totalRevenue) },
          { label: "Número de transacciones", value: filteredSales.length.toString() },
        ]
      );
    } else if (activeReport === "inventory") {
      exportToPDF(
        "Reporte de Inventario",
        ["Producto", "SKU", "Stock", "Estado", "Valor"],
        inventoryData.map(d => [d.Producto, d.SKU, d.Stock.toString(), d.Estado, formatCurrency(parseFloat(d.ValorInventario))]),
        "reporte-inventario",
        [{ label: "Valor total del inventario", value: formatCurrency(totalInventoryValue) }]
      );
    } else if (activeReport === "profit") {
      exportToPDF(
        "Reporte de Ganancias",
        ["Producto", "P. Compra", "P. Venta", "Ganancia", "Margen %"],
        profitData.slice(0, 30).map(d => [d.Producto, formatCurrency(parseFloat(d.PrecioCompra)), formatCurrency(parseFloat(d.PrecioVenta)), formatCurrency(parseFloat(d.Ganancia)), d.MargenPct + "%"]),
        "reporte-ganancias",
        [{ label: "Ganancia total del período", value: formatCurrency(totalProfit) }]
      );
    }
    showToast("Reporte exportado a PDF", "success");
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
            <p className="text-slate-500">Análisis completo de tu negocio</p>
          </div>
          <div className="flex gap-2">
            {(["today", "week", "month", "all"] as const).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "primary" : "secondary"}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === "today" && "Hoy"}
                {range === "week" && "Semana"}
                {range === "month" && "Mes"}
                {range === "all" && "Todo"}
              </Button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Ingresos Totales</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Ganancia Estimada</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalProfit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Transacciones</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{filteredSales.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Valor Inventario</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalInventoryValue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  activeReport === tab.id
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Export buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportExcel} leftIcon={<FileSpreadsheet className="w-4 h-4" />}>
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} leftIcon={<Download className="w-4 h-4" />}>
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPDF} leftIcon={<FileText className="w-4 h-4" />}>
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
            Imprimir
          </Button>
        </div>

        {/* Report Content */}
        {activeReport === "sales" && (
          <Card>
            <CardHeader title="Detalle de Ventas" subtitle={`${filteredSales.length} transacciones`} />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Ticket</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Total</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Método</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.slice(0, 20).map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs">{sale.ticketNumber}</td>
                        <td className="px-4 py-3">{formatDate(sale.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(sale.total)}</td>
                        <td className="px-4 py-3 capitalize">{sale.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <Badge variant={sale.status === "completed" ? "success" : "danger"}>{sale.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredSales.length === 0 && (
                  <p className="text-center py-8 text-slate-400">No hay ventas en este período</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeReport === "profit" && (
          <Card>
            <CardHeader title="Análisis de Ganancias por Producto" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Producto</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">P. Compra</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">P. Venta</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Ganancia</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profitData.slice(0, 20).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{item.Producto}</td>
                        <td className="px-4 py-3">{formatCurrency(parseFloat(item.PrecioCompra))}</td>
                        <td className="px-4 py-3">{formatCurrency(parseFloat(item.PrecioVenta))}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(parseFloat(item.Ganancia))}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info">{item.MargenPct}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeReport === "inventory" && (
          <Card>
            <CardHeader title="Estado del Inventario" subtitle={`Valor total: ${formatCurrency(totalInventoryValue)}`} />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Producto</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Categoría</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Stock</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-500">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryData.slice(0, 20).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{item.Producto}</td>
                        <td className="px-4 py-3">{item.Categoria}</td>
                        <td className="px-4 py-3">{item.Stock}</td>
                        <td className="px-4 py-3">
                          <Badge variant={item.Estado === "Agotado" ? "danger" : item.Estado === "Stock Bajo" ? "warning" : "success"}>
                            {item.Estado}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(parseFloat(item.ValorInventario))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeReport === "topProducts" && (
          <Card>
            <CardHeader title="Productos Más Vendidos" />
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsData} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Bar dataKey="total" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {activeReport === "byCategory" && (
          <Card>
            <CardHeader title="Ventas por Categoría" />
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={140}
                      label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {activeReport === "byPayment" && (
          <Card>
            <CardHeader title="Ventas por Método de Pago" />
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={140}
                      label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedLayout>
  );
}

export default function ReportsPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ReportsContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
