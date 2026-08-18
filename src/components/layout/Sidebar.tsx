"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Store,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileBarChart,
  ClipboardList,
  Award,
  Tag,
  X,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const menuItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { path: "/pos", label: "Punto de Venta", icon: ShoppingCart, module: "pos" },
  { path: "/inventory", label: "Inventario", icon: Package, module: "inventory" },
  { path: "/sales", label: "Ventas", icon: BarChart3, module: "sales" },
  { path: "/returns", label: "Devoluciones", icon: RotateCcw, module: "sales" },
  { path: "/customers", label: "Clientes", icon: Users, module: "customers" },
  { path: "/suppliers", label: "Proveedores", icon: Truck, module: "suppliers" },
  { path: "/purchase-orders", label: "Órdenes de Compra", icon: ClipboardList, module: "suppliers" },
  { path: "/labels", label: "Etiquetas", icon: Tag, module: "inventory" },
  { path: "/cash", label: "Caja", icon: Wallet, module: "cash" },
  { path: "/reports", label: "Reportes", icon: FileBarChart, module: "reports" },
  { path: "/loyalty", label: "Lealtad", icon: Award, module: "customers" },
  { path: "/users", label: "Usuarios", icon: Users, module: "users" },
  { path: "/settings", label: "Configuración", icon: Settings, module: "settings" },
];

export function Sidebar({ isCollapsed, onToggle, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();

  const visibleMenuItems = menuItems.filter((item) => hasPermission(item.module));

  return (
    <>
    {/* Overlay móvil */}
    {isMobileOpen && (
      <div
        className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onMobileClose}
      />
    )}
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-white/95 backdrop-blur-xl border-r border-slate-200/80",
        "transition-all duration-300 ease-in-out z-50 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        isCollapsed ? "lg:w-20" : "lg:w-64",
        "w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div className={cn(isCollapsed && "lg:hidden")}>
            <h1 className="font-bold text-slate-900 whitespace-nowrap">Mi Tienda</h1>
            <p className="text-xs text-slate-500 whitespace-nowrap">POS System</p>
          </div>
        </Link>
        <button
          onClick={onToggle}
          className="hidden lg:block p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);

            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={cn("whitespace-nowrap", isCollapsed && "lg:hidden")}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className={cn("ml-auto w-1.5 h-1.5 rounded-full bg-blue-500", isCollapsed && "lg:hidden")} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <div className={cn("flex-1 min-w-0", isCollapsed && "lg:hidden")}>
            <p className="font-medium text-slate-900 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
