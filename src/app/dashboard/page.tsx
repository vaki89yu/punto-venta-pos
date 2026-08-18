"use client";

import React, { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { StatCard } from "@/components/dashboard/StatCard";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useSales } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useReturns } from "@/hooks/useReturns";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Clock,
  Target,
  Truck,
  RotateCcw,
} from "lucide-react";
import { Sale, Product, Customer } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import Link from "next/link";

const DAILY_GOAL = 10000;
const MONTHLY_GOAL = 250000;

function DashboardContent() {
  const { getSalesStats, getTodaySales, sales } = useSales();
  const { getLowStockProducts, getOutOfStockProducts, products } = useProducts();
  const { getPendingOrders } = usePurchaseOrders();
  const { returns } = useReturns();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [salesPeriod, setSalesPeriod] = useState<"day" | "week" | "month">("day");

  useEffect(() => {
    const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (storedCustomers) {
      setCustomers(JSON.parse(storedCustomers));
    }
  }, []);

  useEffect(() => {
    const activity = [
      ...sales.slice(0, 5).map((sale) => ({
        type: "sale",
        title: `Venta ${sale.ticketNumber}`,
        description: `${formatCurrency(sale.total)} - ${sale.paymentMethod === "cash" ? "Efectivo" : "Tarjeta"}`,
        time: sale.createdAt,
        icon: Receipt,
        color: "emerald",
      })),
      ...products
        .filter((p) => p.stock <= p.minStock)
        .slice(0, 3)
        .map((product) => ({
          type: "stock",
          title: "Stock bajo",
          description: `${product.name} - ${product.stock} unidades`,
          time: new Date(),
          icon: AlertTriangle,
          color: "amber",
        })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    setRecentActivity(activity);
  }, [sales, products]);

  const stats = getSalesStats();
  const todaySales = getTodaySales();
  const lowStockProducts = getLowStockProducts();
  const outOfStockProducts = getOutOfStockProducts();

  // Generate chart data
  const chartData = {
    day: Array.from({ length: 12 }, (_, i) => ({
      name: `${8 + i}:00`,
      sales: Math.floor(Math.random() * 2000) + 500,
    })),
    week: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => ({
      name: day,
      sales: Math.floor(Math.random() * 5000) + 2000,
    })),
    month: Array.from({ length: 4 }, (_, i) => ({
      name: `Sem ${i + 1}`,
      sales: Math.floor(Math.random() * 20000) + 10000,
    })),
  };

  const topProducts = products
    .slice(0, 5)
    .map((p) => ({
      name: p.name.length > 20 ? p.name.substring(0, 20) + "..." : p.name,
      sales: Math.floor(Math.random() * 5000) + 1000,
      quantity: Math.floor(Math.random() * 50) + 10,
    }));

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-500">
              Resumen de tu tienda hoy
            </p>
          </div>
          <Link
            href="/pos"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 hover:shadow-xl transition-all"
          >
            <ShoppingCart className="w-5 h-5" />
            Nueva Venta
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ventas de hoy"
            value={formatCurrency(stats.todayTotal)}
            subtitle={`${stats.todayTransactions} transacciones`}
            icon={DollarSign}
            color="emerald"
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Ventas del mes"
            value={formatCurrency(stats.monthTotal)}
            subtitle="Este mes"
            icon={TrendingUp}
            color="blue"
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Productos vendidos"
            value={stats.todayProducts}
            subtitle="Hoy"
            icon={ShoppingCart}
            color="violet"
          />
          <StatCard
            title="Clientes registrados"
            value={customers.length}
            subtitle="Total"
            icon={Users}
            color="amber"
          />
        </div>

        {/* Alerts */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outOfStockProducts.length > 0 && (
              <div className="p-4 bg-red-50/80 border border-red-100 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Package className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-700">
                      {outOfStockProducts.length} productos agotados
                    </p>
                    <p className="text-sm text-red-500">
                      Revisa tu inventario urgentemente
                    </p>
                  </div>
                </div>
              </div>
            )}
            {lowStockProducts.length > 0 && (
              <div className="p-4 bg-amber-50/80 border border-amber-100 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-700">
                      {lowStockProducts.length} productos con stock bajo
                    </p>
                    <p className="text-sm text-amber-500">
                      Considera reabastecer pronto
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metas de Venta */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Target className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="font-medium text-slate-700">Meta Diaria</span>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {formatCurrency(stats.todayTotal)} / {formatCurrency(DAILY_GOAL)}
                </span>
              </div>
              <Progress value={stats.todayTotal} max={DAILY_GOAL} color="green" showValue />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Target className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-medium text-slate-700">Meta Mensual</span>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {formatCurrency(stats.monthTotal)} / {formatCurrency(MONTHLY_GOAL)}
                </span>
              </div>
              <Progress value={stats.monthTotal} max={MONTHLY_GOAL} color="blue" showValue />
            </CardContent>
          </Card>
        </div>

        {/* Accesos rápidos a nuevos módulos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/purchase-orders" className="group">
            <Card hover>
              <CardContent className="p-4 text-center">
                <Truck className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Órdenes</p>
                <p className="text-xs text-slate-400">{getPendingOrders().length} pendientes</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/returns" className="group">
            <Card hover>
              <CardContent className="p-4 text-center">
                <RotateCcw className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Devoluciones</p>
                <p className="text-xs text-slate-400">{returns.length} registradas</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/reports" className="group">
            <Card hover>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Reportes</p>
                <p className="text-xs text-slate-400">Ver análisis</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/loyalty" className="group">
            <Card hover>
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Lealtad</p>
                <p className="text-xs text-slate-400">Clientes VIP</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="Ventas"
              action={
                <div className="flex gap-1">
                  {(["day", "week", "month"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSalesPeriod(period)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        salesPeriod === period
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {period === "day" && "Hoy"}
                      {period === "week" && "Semana"}
                      {period === "month" && "Mes"}
                    </button>
                  ))}
                </div>
              }
            />
            <CardContent>
              <SalesChart data={chartData[salesPeriod]} period={salesPeriod} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Productos más vendidos" />
            <CardContent>
              <TopProductsChart data={topProducts} />
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader title="Actividad reciente" />
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No hay actividad reciente
                </p>
              ) : (
                recentActivity.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          activity.color === "emerald"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                            : activity.color === "amber"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {activity.title}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {activity.description}
                        </p>
                      </div>
                      <span className="text-sm text-slate-400">
                        {formatDateTime(activity.time)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}

export default function DashboardPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DashboardContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
