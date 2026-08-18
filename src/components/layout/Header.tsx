"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, formatDateTime } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  Command,
  ShoppingCart,
  Package,
  User,
  FileText,
} from "lucide-react";
import { Product, Customer, Sale } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { NotificationCenter } from "./NotificationCenter";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme, isDark } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    products: Product[];
    customers: Customer[];
    sales: Sale[];
  }>({ products: [], customers: [], sales: [] });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ products: [], customers: [], sales: [] });
      return;
    }

    const query = searchQuery.toLowerCase();
    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || "[]");
    const customers = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || "[]");
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || "[]");

    setSearchResults({
      products: products
        .filter((p: Product) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.barcode.includes(query)
        )
        .slice(0, 5),
      customers: customers
        .filter((c: Customer) =>
          c.name.toLowerCase().includes(query) ||
          c.phone?.includes(query) ||
          c.email?.toLowerCase().includes(query)
        )
        .slice(0, 5),
      sales: sales
        .filter((s: Sale) =>
          s.ticketNumber.toLowerCase().includes(query)
        )
        .slice(0, 5),
    });
  }, [searchQuery]);

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/pos": "Punto de Venta",
      "/inventory": "Inventario",
      "/sales": "Ventas",
      "/customers": "Clientes",
      "/suppliers": "Proveedores",
      "/cash": "Control de Caja",
      "/settings": "Configuración",
    };
    return titles[pathname] || "Mi Tienda POS";
  };

  return (
    <>
      <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          {/* Left section */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-base sm:text-xl font-semibold text-slate-900 truncate">
              {getPageTitle()}
            </h1>
          </div>

          {/* Center section - Search */}
          <div className="flex-1 max-w-xl hidden md:block">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left text-sm">Buscar productos, clientes, ventas...</span>
              <kbd className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-xs font-medium">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <NotificationCenter />

            {/* Time */}
            <div className="hidden lg:block text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentTime.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSearchOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 dark:border-slate-700">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar productos, clientes, ventas..."
                className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {!searchQuery.trim() ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Command className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Escribe para buscar productos, clientes o ventas</p>
                  <div className="flex justify-center gap-4 mt-4 text-sm">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">↑↓ Navegar</span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">↵ Seleccionar</span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">Esc Cerrar</span>
                  </div>
                </div>
              ) : (
                <>
                  {searchResults.products.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Productos
                      </h3>
                      {searchResults.products.map((product) => (
                        <Link
                          key={product.id}
                          href={`/inventory?product=${product.id}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <Package className="w-5 h-5 text-slate-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                            <p className="text-sm text-slate-500">{product.sku}</p>
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            ${product.salePrice.toFixed(2)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.customers.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Clientes
                      </h3>
                      {searchResults.customers.map((customer) => (
                        <Link
                          key={customer.id}
                          href={`/customers?id=${customer.id}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{customer.name}</p>
                            <p className="text-sm text-slate-500">{customer.phone || customer.email}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.sales.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Ventas
                      </h3>
                      {searchResults.sales.map((sale) => (
                        <Link
                          key={sale.id}
                          href={`/sales?id=${sale.id}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-slate-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{sale.ticketNumber}</p>
                            <p className="text-sm text-slate-500">
                              {new Date(sale.createdAt).toLocaleDateString("es-MX")}
                            </p>
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            ${sale.total.toFixed(2)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim() &&
                    searchResults.products.length === 0 &&
                    searchResults.customers.length === 0 &&
                    searchResults.sales.length === 0 && (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <p>No se encontraron resultados</p>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
