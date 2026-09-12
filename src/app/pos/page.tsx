"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Cart } from "@/components/pos/Cart";
import { InnovativeCheckout } from "@/components/pos/InnovativeCheckout";
import { QuickProductModal } from "@/components/pos/QuickProductModal";
import { BarcodeScanner, ScanFeedback } from "@/components/scanner/BarcodeScanner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { useAuth } from "@/contexts/AuthContext";
import { Product, Customer, Category } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { formatCurrency } from "@/lib/utils";
import {
  Scan,
  Search,
  Zap,
  Package,
  ShoppingCart as CartIcon,
  X,
  Grid3X3,
} from "lucide-react";

function POSContent() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { products, getProductByBarcode, searchProducts, addProduct, updateProduct } = useProducts();
  const { createSale } = useSales();
  const { items, addItem, clearCart, subtotal, tax, total, itemCount } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [scannerContinuous, setScannerContinuous] = useState(false);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Nuevo producto escaneado
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [showCodesHelp, setShowCodesHelp] = useState(false);

  // Vista móvil: productos o carrito
  const [mobileView, setMobileView] = useState<"products" | "cart">("products");

  useEffect(() => {
    const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (storedCategories) setCategories(JSON.parse(storedCategories));
    if (storedCustomers) setCustomers(JSON.parse(storedCustomers));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === "F3") {
        e.preventDefault();
        setShowScanner(true);
      }
      if (e.key === "F4" && items.length > 0) {
        e.preventDefault();
        setShowCheckout(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items.length]);

  const playBeep = useCallback((ok: boolean) => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = ok ? 1200 : 400;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      /* ignore */
    }
  }, []);

  const handleScan = useCallback(
    (barcode: string) => {
      const product = getProductByBarcode(barcode);

      // CASO 1: El producto YA EXISTE → agregar al carrito para vender
      if (product) {
        if (product.stock > 0) {
          addItem(product);
          setScannedCount((c) => c + 1);
          setScanFeedback({ type: "found", product, barcode });
          playBeep(true);
          showToast(`${product.name} · ${formatCurrency(product.salePrice)}`, "success");

          setTimeout(() => setScanFeedback(null), 1300);
          if (!scannerContinuous) {
            setTimeout(() => setShowScanner(false), 900);
          }
        } else {
          // Existe pero sin stock
          setScanFeedback({ type: "outofstock", product, barcode });
          playBeep(false);
          showToast(`"${product.name}" está agotado`, "error");
          setTimeout(() => setScanFeedback(null), 1600);
        }
        return;
      }

      // CASO 2: Código NUEVO → abrir registro de producto
      setScanFeedback({ type: "new", barcode });
      playBeep(false);
      setTimeout(() => {
        setScanFeedback(null);
        setShowScanner(false);
        setNewBarcode(barcode);
      }, 1100);
    },
    [getProductByBarcode, addItem, showToast, scannerContinuous, playBeep]
  );

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeInput("");

    const product = getProductByBarcode(code);
    if (product) {
      if (product.stock > 0) {
        addItem(product);
        playBeep(true);
        showToast(`${product.name} · ${formatCurrency(product.salePrice)}`, "success");
      } else {
        playBeep(false);
        showToast(`"${product.name}" está agotado`, "error");
      }
    } else {
      playBeep(false);
      showToast("Código nuevo, registra el producto", "info");
      setNewBarcode(code);
    }
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      setSearchResults(searchProducts(query));
    } else {
      setSearchResults([]);
    }
  };

  const handleSaveNewProduct = (
    productData: Omit<Product, "id" | "createdAt" | "updatedAt">,
    addToCart: boolean
  ) => {
    const created = addProduct(productData);
    setNewBarcode(null);
    if (addToCart) {
      addItem(created);
      setScannedCount((c) => c + 1);
      showToast(`"${created.name}" registrado y agregado al carrito`, "success");
    } else {
      showToast(`"${created.name}" registrado en inventario`, "success");
    }
  };

  const handleScanAgain = () => {
    setNewBarcode(null);
    setTimeout(() => setShowScanner(true), 200);
  };

  const handleCheckout = (paymentData: {
    method: string;
    cashReceived?: number;
    change?: number;
    paymentDetails: { method: "cash" | "card" | "transfer"; amount: number; reference?: string }[];
  }) => {
    if (!user) return;
    createSale(
      items,
      selectedCustomer,
      user.id,
      paymentData.method as any,
      paymentData.paymentDetails,
      paymentData.cashReceived,
      paymentData.change
    );

    // Descontar el stock vendido del inventario
    items.forEach((item) => {
      const current = getProductByBarcode(item.product.barcode) || item.product;
      const newStock = Math.max(0, current.stock - item.quantity);
      updateProduct(current.id, { stock: newStock });
    });

    clearCart();
    setShowCheckout(false);
    setMobileView("products");
    showToast("Venta completada · Inventario actualizado", "success");
  };

  return (
    <ProtectedLayout>
      <div className="lg:h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 pb-20 lg:pb-0">
        {/* Panel izquierdo - Productos */}
        <div
          className={`flex-1 bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden ${
            mobileView === "cart" ? "hidden lg:block" : "block"
          }`}
        >
          {/* Barra de acciones rápidas */}
          <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur-sm">
            {/* Botón escanear grande en móvil */}
            <button
              onClick={() => setShowScanner(true)}
              className="lg:hidden w-full mb-3 flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform"
            >
              <Scan className="w-6 h-6" />
              ESCANEAR PRODUCTO
            </button>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowScanner(true)}
                leftIcon={<Scan className="w-4 h-4" />}
                className="hidden lg:inline-flex"
              >
                Escanear (F3)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCodesHelp(true)}
                className="hidden sm:inline-flex"
                title="Ver códigos de prueba"
              >
                Códigos
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSearchModal(true)}
                leftIcon={<Search className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Buscar (F2)</span>
                <span className="sm:hidden">Buscar</span>
              </Button>
              <form onSubmit={handleBarcodeSubmit} className="flex-1 min-w-[140px]">
                <Input
                  placeholder="Código de barras..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  leftIcon={<Scan className="w-4 h-4" />}
                  className="h-9"
                  inputMode="numeric"
                />
              </form>
              <Button
                variant={scannerContinuous ? "success" : "secondary"}
                size="sm"
                onClick={() => setScannerContinuous(!scannerContinuous)}
                leftIcon={<Zap className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Continuo</span>
              </Button>
            </div>
          </div>

          {/* Grid de productos */}
          <div className="h-auto lg:h-[calc(100%-80px)]">
            <ProductGrid products={products} categories={categories} onAddToCart={addItem} />
          </div>
        </div>

        {/* Panel derecho - Carrito */}
        <div
          className={`w-full lg:w-96 bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden ${
            mobileView === "products" ? "hidden lg:block" : "block"
          }`}
        >
          <Cart customers={customers} onCheckout={() => setShowCheckout(true)} />
        </div>
      </div>

      {/* Barra inferior móvil */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setMobileView("products")}
            className={`flex flex-col items-center gap-1 py-3 transition-colors ${
              mobileView === "products" ? "text-blue-600 bg-blue-50" : "text-slate-500"
            }`}
          >
            <Grid3X3 className="w-5 h-5" />
            <span className="text-xs font-semibold">Productos</span>
          </button>
          <button
            onClick={() => setMobileView("cart")}
            className={`relative flex flex-col items-center gap-1 py-3 transition-colors ${
              mobileView === "cart" ? "text-emerald-600 bg-emerald-50" : "text-slate-500"
            }`}
          >
            <CartIcon className="w-5 h-5" />
            <span className="text-xs font-semibold">
              Carrito {itemCount > 0 && `· ${formatCurrency(total)}`}
            </span>
            {itemCount > 0 && (
              <span className="absolute top-1.5 right-1/2 translate-x-8 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Escáner */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => {
          setShowScanner(false);
          setScanFeedback(null);
          setScannedCount(0);
        }}
        onScan={handleScan}
        continuous={scannerContinuous}
        feedback={scanFeedback}
        scannedCount={scannedCount}
      />

      {/* Registro rápido de producto nuevo */}
      <QuickProductModal
        isOpen={!!newBarcode}
        barcode={newBarcode || ""}
        onClose={() => setNewBarcode(null)}
        onSave={handleSaveNewProduct}
        onScanAgain={handleScanAgain}
      />

      {/* Checkout */}
      <InnovativeCheckout
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        total={total}
        subtotal={subtotal}
        tax={tax}
        items={items}
        customer={selectedCustomer}
        onComplete={handleCheckout}
      />

      {/* Códigos de prueba */}
      <Modal
        isOpen={showCodesHelp}
        onClose={() => setShowCodesHelp(false)}
        title="Códigos de barras registrados"
        size="lg"
      >
        <p className="text-sm text-slate-500 mb-4">
          Estos productos ya están en tu inventario. Al escanearlos se agregan al carrito automáticamente.
        </p>
        <div className="max-h-[55vh] overflow-y-auto space-y-2">
          {products.slice(0, 40).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (p.stock > 0) {
                  addItem(p);
                  playBeep(true);
                  showToast(`${p.name} agregado`, "success");
                }
              }}
              className="w-full flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors"
            >
              <div className="text-left min-w-0">
                <p className="font-medium text-sm text-slate-900 truncate">{p.name}</p>
                <p className="font-mono text-xs text-slate-500">{p.barcode}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-emerald-600">{formatCurrency(p.salePrice)}</p>
                <p className="text-xs text-slate-400">Stock: {p.stock}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Búsqueda */}
      <Modal
        isOpen={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          setSearchResults([]);
        }}
        title="Buscar producto"
      >
        <div className="space-y-4">
          <Input
            placeholder="Buscar por nombre, SKU o código..."
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  addItem(product);
                  setShowSearchModal(false);
                  setSearchResults([]);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product.image ? (
                    <img src={product.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-slate-900 truncate">{product.name}</p>
                  <p className="text-sm text-slate-500">SKU: {product.sku}</p>
                </div>
                <span className="font-semibold text-blue-600 flex-shrink-0">
                  {formatCurrency(product.salePrice)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </ProtectedLayout>
  );
}

export default function POSPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <POSContent />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
