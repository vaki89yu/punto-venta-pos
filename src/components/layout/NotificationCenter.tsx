"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Bell, AlertTriangle, Package, TrendingUp, X, CheckCircle } from "lucide-react";

interface Notification {
  id: string;
  type: "warning" | "success" | "info" | "danger";
  title: string;
  message: string;
  time: Date;
  icon: any;
}

export function NotificationCenter() {
  const { getLowStockProducts, getOutOfStockProducts } = useProducts();
  const { getTodaySales } = useSales();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const lowStock = getLowStockProducts();
  const outOfStock = getOutOfStockProducts();
  const todaySales = getTodaySales();

  const notifications: Notification[] = [
    ...outOfStock.slice(0, 3).map(p => ({
      id: `out-${p.id}`,
      type: "danger" as const,
      title: "Producto agotado",
      message: `${p.name} está sin stock`,
      time: new Date(),
      icon: Package,
    })),
    ...lowStock.slice(0, 3).map(p => ({
      id: `low-${p.id}`,
      type: "warning" as const,
      title: "Stock bajo",
      message: `${p.name} tiene solo ${p.stock} unidades`,
      time: new Date(),
      icon: AlertTriangle,
    })),
    ...(todaySales.length > 0 ? [{
      id: "sales-today",
      type: "success" as const,
      title: "Ventas del día",
      message: `${todaySales.length} ventas completadas hoy`,
      time: new Date(),
      icon: TrendingUp,
    }] : []),
  ];

  const unreadCount = notifications.length;

  const typeStyles = {
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    danger: "bg-red-50 text-red-600 border-red-100",
    success: "bg-emerald-50 text-emerald-600 border-emerald-100",
    info: "bg-blue-50 text-blue-600 border-blue-100",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-scale-in">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Notificaciones</h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Todo está en orden</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((notif) => {
                  const Icon = notif.icon;
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${typeStyles[notif.type]}`}
                    >
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{notif.title}</p>
                        <p className="text-xs opacity-80 truncate">{notif.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
