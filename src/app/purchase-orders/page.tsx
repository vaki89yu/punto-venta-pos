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
import { usePurchaseOrders, PurchaseOrderItem } from "@/hooks/usePurchaseOrders";
import { useProducts } from "@/hooks/useProducts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Supplier } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { Plus, Truck, Package, CheckCircle, Clock, X, Trash2, Phone, Mail, MapPin, Building2, User } from "lucide-react";

function PurchaseOrdersContent() {
  const { showToast } = useToast();
  const { orders, createOrder, updateOrderStatus, getTotalPending } = usePurchaseOrders();
  const { products, updateProduct } = useProducts();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [supplierSearch, setSupplierSearch] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    if (stored) setSuppliers(JSON.parse(stored));
  }, []);

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.company.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const handleAddItem = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product || !quantity) return;

    const qty = parseInt(quantity);
    const newItem: PurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitCost: product.purchasePrice,
      total: qty * product.purchasePrice,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProductId("");
    setQuantity("1");
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const totalOrder = orderItems.reduce((sum, item) => sum + item.total, 0);

  const handleCreateOrder = () => {
    if (!selectedSupplier || orderItems.length === 0) {
      showToast("Selecciona un proveedor y agrega productos", "warning");
      return;
    }

    createOrder({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      items: orderItems,
      total: totalOrder,
    });

    showToast("Orden de compra creada exitosamente", "success");
    setShowModal(false);
    setOrderItems([]);
    setSelectedSupplier(null);
  };

  const handleReceiveOrder = (order: any) => {
    order.items.forEach((item: PurchaseOrderItem) => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        updateProduct(item.productId, { stock: product.stock + item.quantity });
      }
    });
    updateOrderStatus(order.id, "received");
    showToast("Mercancía recibida y stock actualizado", "success");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="warning">Pendiente</Badge>;
      case "ordered": return <Badge variant="info">Ordenado</Badge>;
      case "received": return <Badge variant="success">Recibido</Badge>;
      case "cancelled": return <Badge variant="danger">Cancelado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Órdenes de Compra</h1>
            <p className="text-slate-500">Gestiona pedidos a proveedores</p>
          </div>
          <Button onClick={() => setShowModal(true)} leftIcon={<Plus className="w-5 h-5" />}>
            Nueva Orden
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Órdenes Totales</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Pendientes de Recibir</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {orders.filter(o => o.status !== "received" && o.status !== "cancelled").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Total Pendiente</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(getTotalPending())}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de proveedores destacados */}
        <Card>
          <CardHeader title="Proveedores Disponibles" subtitle={`${suppliers.length} proveedores registrados`} />
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {suppliers.slice(0, 6).map(supplier => (
                <button
                  key={supplier.id}
                  onClick={() => {
                    setSelectedSupplier(supplier);
                    setShowModal(true);
                  }}
                  className="group p-4 bg-white border-2 border-slate-200 rounded-xl text-left hover:border-emerald-400 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{supplier.name}</p>
                      <p className="text-xs text-slate-500 truncate">{supplier.company}</p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {supplier.phone && (
                      <p className="flex items-center gap-1 truncate">
                        <Phone className="w-3 h-3 text-slate-400" /> {supplier.phone}
                      </p>
                    )}
                    {supplier.email && (
                      <p className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-slate-400" /> {supplier.email}
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    + Crear orden de compra
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historial de Órdenes" />
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400">No hay órdenes de compra registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => {
                  const supplier = suppliers.find(s => s.id === order.supplierId);
                  return (
                    <div key={order.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Building2 className="w-4 h-4 text-slate-700" />
                            <span className="font-bold text-slate-900">{order.supplierName}</span>
                          </div>
                          {supplier?.company && (
                            <p className="text-xs text-slate-600 ml-6">{supplier.company}</p>
                          )}
                          {supplier?.phone && (
                            <p className="text-xs text-slate-500 ml-6 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {supplier.phone}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(order.status)}
                          <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(order.total)}</p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 mb-3 border-t border-slate-200 pt-2">
                        {order.items.map((item, idx) => (
                          <p key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.productName}</span>
                            <span className="font-mono font-semibold text-slate-900">{formatCurrency(item.total)}</span>
                          </p>
                        ))}
                      </div>
                      {order.status !== "received" && order.status !== "cancelled" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" onClick={() => handleReceiveOrder(order)} leftIcon={<CheckCircle className="w-4 h-4" />}>
                            Marcar como Recibida
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => updateOrderStatus(order.id, "cancelled")}>
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva Orden de Compra" size="lg">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-800 mb-2 block">Proveedor *</label>
              <Input
                placeholder="Buscar proveedor..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                leftIcon={<SearchIcon />}
                className="mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredSuppliers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSupplier(s);
                      setSupplierSearch("");
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      selectedSupplier?.id === s.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500 truncate">{s.company}</p>
                    </div>
                    {s.phone && (
                      <span className="text-xs text-slate-500 hidden sm:block">{s.phone}</span>
                    )}
                  </button>
                ))}
              </div>
              {selectedSupplier && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-1">Proveedor seleccionado</p>
                  <p className="font-bold text-slate-900">{selectedSupplier.name}</p>
                  <p className="text-xs text-slate-600">{selectedSupplier.company}</p>
                  {selectedSupplier.phone && <p className="text-xs text-slate-600">📞 {selectedSupplier.phone}</p>}
                  {selectedSupplier.email && <p className="text-xs text-slate-600">✉️ {selectedSupplier.email}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900"
              >
                <option value="">Selecciona un producto</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.purchasePrice)}</option>
                ))}
              </select>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-20 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900"
                min="1"
              />
              <Button onClick={handleAddItem} leftIcon={<Plus className="w-4 h-4" />}>
                Agregar
              </Button>
            </div>

            {orderItems.length > 0 && (
              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-800">{item.quantity}x {item.productName}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-900">{formatCurrency(item.total)}</span>
                      <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between p-3 bg-emerald-50 rounded-xl font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(totalOrder)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button fullWidth onClick={handleCreateOrder} disabled={!selectedSupplier || orderItems.length === 0}>
                Crear Orden
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <PurchaseOrdersContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
