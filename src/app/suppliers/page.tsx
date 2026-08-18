"use client";

import React, { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Supplier } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { STORAGE_KEYS } from "@/data/seed";
import { Search, Plus, Truck, Phone, Mail, MapPin, Package } from "lucide-react";

function SuppliersContent() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    if (stored) setSuppliers(JSON.parse(stored));
  }, []);

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  const handleAddSupplier = (formData: any) => {
    const newSupplier: Supplier = {
      ...formData,
      id: Math.random().toString(36).substring(2, 9),
      balance: 0,
      isActive: true,
      createdAt: new Date(),
    };
    const updated = [...suppliers, newSupplier];
    setSuppliers(updated);
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(updated));
    setShowAddModal(false);
    showToast("Proveedor agregado exitosamente", "success");
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Proveedores</h1>
            <p className="text-slate-500 dark:text-slate-400">
              {suppliers.length} proveedores registrados
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="w-5 h-5" />}>
            Agregar proveedor
          </Button>
        </div>

        <Card>
          <div className="p-4">
            <Input
              placeholder="Buscar proveedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} hover>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {supplier.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {supplier.company}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Phone className="w-4 h-4" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{supplier.address}</span>
                    </div>
                  )}
                </div>

                {supplier.balance > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500">Saldo pendiente</p>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(supplier.balance)}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Agregar proveedor">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              handleAddSupplier({
                name: formData.get("name"),
                company: formData.get("company"),
                phone: formData.get("phone"),
                email: formData.get("email"),
                address: formData.get("address"),
              });
            }}
            className="space-y-4"
          >
            <Input label="Nombre *" name="name" required />
            <Input label="Empresa *" name="company" required />
            <Input label="Teléfono" name="phone" />
            <Input label="Email" name="email" type="email" />
            <Input label="Dirección" name="address" />
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar proveedor</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

export default function SuppliersPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <SuppliersContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
