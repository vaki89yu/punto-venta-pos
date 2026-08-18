"use client";

import React, { useState, useEffect } from "react";
import JsBarcode from "jsbarcode";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useProducts } from "@/hooks/useProducts";
import { formatCurrency } from "@/lib/utils";
import { Product, Category } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { Printer, Search, Tag, Plus, Minus, Eye, Store } from "lucide-react";

function LabelsContent() {
  const { showToast } = useToast();
  const { products } = useProducts();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<{ product: Product; qty: number }[]>([]);
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">("medium");
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const barcodeRef = React.useRef<SVGSVGElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (stored) setCategories(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (previewProduct && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, previewProduct.barcode, {
          format: "EAN13",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          font: "monospace",
          margin: 5,
        });
      } catch {
        try {
          JsBarcode(barcodeRef.current, previewProduct.barcode, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 14,
            margin: 5,
          });
        } catch {
          // ignore
        }
      }
    }
  }, [previewProduct]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode.includes(searchQuery)
  );

  const handleAddProduct = (product: Product) => {
    const exists = selectedProducts.find(sp => sp.product.id === product.id);
    if (exists) {
      setSelectedProducts(selectedProducts.map(sp =>
        sp.product.id === product.id ? { ...sp, qty: sp.qty + 1 } : sp
      ));
    } else {
      setSelectedProducts([...selectedProducts, { product, qty: 1 }]);
    }
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setSelectedProducts(selectedProducts.map(sp =>
      sp.product.id === productId ? { ...sp, qty: Math.max(1, sp.qty + delta) } : sp
    ).filter(sp => sp.qty > 0));
  };

  const handleRemove = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(sp => sp.product.id !== productId));
  };

  const getCategoryName = (categoryId?: string) => {
    return categories.find(c => c.id === categoryId)?.name || "";
  };

  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      showToast("Selecciona al menos un producto", "warning");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sizeStyles = {
      small: { width: "58mm", height: "30mm", nameSize: "8px", priceSize: "14px", barcodeHeight: 24, fontSize: "8px" },
      medium: { width: "70mm", height: "38mm", nameSize: "10px", priceSize: "18px", barcodeHeight: 34, fontSize: "10px" },
      large: { width: "80mm", height: "45mm", nameSize: "12px", priceSize: "22px", barcodeHeight: 44, fontSize: "11px" },
    };

    const style = sizeStyles[labelSize];

    let labelsHtml = "";
    selectedProducts.forEach(({ product, qty }) => {
      for (let i = 0; i < qty; i++) {
        const cat = getCategoryName(product.categoryId);
        labelsHtml += `
          <div class="label" style="width: ${style.width}; height: ${style.height};">
            <div class="label-inner">
              ${showStoreName ? `
                <div class="label-store">
                  <span class="store-icon">🏪</span> ABARROTES LA ESQUINA
                </div>` : ""}
              <div class="label-name" style="font-size: ${style.nameSize};">${product.name}</div>
              <div class="label-cat">${cat}</div>
              <svg class="barcode-svg" data-code="${product.barcode}" data-height="${style.barcodeHeight}"></svg>
              ${showSku ? `<div class="label-sku">REF: ${product.sku}</div>` : ""}
              ${showPrice ? `<div class="label-price" style="font-size: ${style.priceSize};">${formatCurrency(product.salePrice)}</div>` : ""}
            </div>
          </div>
        `;
      }
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiquetas de Precio - Abarrotes La Esquina</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { size: auto; margin: 5mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 2mm;
              justify-content: flex-start;
            }
            .label {
              border: 1px dashed #999;
              border-radius: 2mm;
              padding: 2mm;
              display: flex;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
              background: #fff;
            }
            .label-inner {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              overflow: hidden;
            }
            .label-store {
              font-size: 7px;
              font-weight: bold;
              letter-spacing: 0.5px;
              color: #000;
              border-bottom: 0.5px solid #000;
              padding-bottom: 1px;
              margin-bottom: 1px;
              width: 100%;
              white-space: nowrap;
            }
            .store-icon { font-size: 7px; }
            .label-name {
              font-weight: bold;
              color: #000;
              line-height: 1.1;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-cat {
              font-size: 7px;
              color: #333;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 1px;
            }
            .label-sku {
              font-size: 7px;
              color: #000;
              font-weight: bold;
              letter-spacing: 0.3px;
              margin-top: 1px;
              font-family: monospace;
            }
            .label-price {
              font-weight: 900;
              color: #000;
              margin-top: 1px;
              line-height: 1;
            }
            .barcode-svg { max-width: 95%; }
            @media print {
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">${labelsHtml}</div>
          <script>
            window.onload = function() {
              document.querySelectorAll('.barcode-svg').forEach(function(svg) {
                try {
                  JsBarcode(svg, svg.getAttribute('data-code'), {
                    format: 'EAN13',
                    width: 1.5,
                    height: parseInt(svg.getAttribute('data-height')),
                    displayValue: true,
                    fontSize: 10,
                    font: 'monospace',
                    margin: 2,
                    background: '#ffffff',
                    lineColor: '#000000',
                  });
                } catch (e) {
                  try {
                    JsBarcode(svg, svg.getAttribute('data-code'), {
                      format: 'CODE128',
                      width: 1.5,
                      height: parseInt(svg.getAttribute('data-height')),
                      displayValue: true,
                      fontSize: 10,
                      font: 'monospace',
                      margin: 2,
                      background: '#ffffff',
                      lineColor: '#000000',
                    });
                  } catch (e2) {}
                }
              });
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    showToast("Enviando etiquetas a imprimir...", "info");
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Generador de Etiquetas</h1>
          <p className="text-slate-500">Crea etiquetas profesionales con código de barras, referencia y precio</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Búsqueda de productos */}
          <Card>
            <CardHeader title="Buscar Productos" />
            <CardContent>
              <Input
                placeholder="Buscar por nombre, SKU o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
              <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
                {filteredProducts.slice(0, 20).map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors"
                  >
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.sku} | {product.barcode}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        onMouseEnter={() => setPreviewProduct(product)}
                        className="p-2 text-slate-400 hover:text-blue-500"
                        title="Vista previa"
                      >
                        <Eye className="w-4 h-4" />
                      </span>
                      <Plus className="w-5 h-5 text-emerald-500" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Etiquetas a imprimir */}
          <Card>
            <CardHeader title="Etiquetas a Imprimir" subtitle={`${selectedProducts.reduce((sum, sp) => sum + sp.qty, 0)} etiquetas`} />
            <CardContent>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Tamaño de etiqueta</label>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(["small", "medium", "large"] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setLabelSize(size)}
                      className={`py-2 rounded-lg font-medium text-sm transition-colors ${
                        labelSize === size
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {size === "small" && "Pequeña"}
                      {size === "medium" && "Mediana"}
                      {size === "large" && "Grande"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded" />
                  Mostrar precio
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showSku} onChange={(e) => setShowSku(e.target.checked)} className="rounded" />
                  Mostrar referencia (SKU)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showStoreName} onChange={(e) => setShowStoreName(e.target.checked)} className="rounded" />
                  Mostrar nombre de tienda
                </label>
              </div>

              {selectedProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Tag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">Selecciona productos para generar etiquetas</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {selectedProducts.map(({ product, qty }) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku} | {formatCurrency(product.salePrice)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleUpdateQty(product.id, -1)} className="w-7 h-7 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-semibold">{qty}</span>
                        <button onClick={() => handleUpdateQty(product.id, 1)} className="w-7 h-7 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleRemove(product.id)} className="text-red-500 text-xs ml-2">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handlePrint} fullWidth leftIcon={<Printer className="w-4 h-4" />} disabled={selectedProducts.length === 0}>
                Imprimir Etiquetas
              </Button>
            </CardContent>
          </Card>

          {/* Vista previa */}
          <Card>
            <CardHeader title="Vista Previa de Etiqueta" subtitle="Así se verá la etiqueta impresa" />
            <CardContent>
              {previewProduct ? (
                <div className="flex justify-center">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 bg-white w-full max-w-[220px]" style={{ width: labelSize === "large" ? "240px" : labelSize === "medium" ? "210px" : "180px" }}>
                    {showStoreName && (
                      <div className="text-[8px] font-bold text-center border-b border-black pb-0.5 mb-1 whitespace-nowrap">
                        🏪 ABARROTES LA ESQUINA
                      </div>
                    )}
                    <div className="text-[11px] font-bold text-center text-black leading-tight truncate">
                      {previewProduct.name}
                    </div>
                    <div className="text-[8px] text-center text-slate-500 uppercase tracking-wide mb-0.5">
                      {getCategoryName(previewProduct.categoryId)}
                    </div>
                    <div className="flex justify-center my-1">
                      <svg ref={barcodeRef} className="w-full max-w-[180px]" />
                    </div>
                    {showSku && (
                      <div className="text-[8px] font-bold text-center font-mono">
                        REF: {previewProduct.sku}
                      </div>
                    )}
                    {showPrice && (
                      <div className="text-xl font-black text-center text-black leading-tight">
                        {formatCurrency(previewProduct.salePrice)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Tag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">Pasa el cursor sobre un producto para ver la vista previa</p>
                </div>
              )}
              <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                💡 Las etiquetas incluyen código de barras escaneable, nombre, categoría, referencia y precio. Ideales para imprimir en papel adhesivo estándar.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}

export default function LabelsPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <LabelsContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
