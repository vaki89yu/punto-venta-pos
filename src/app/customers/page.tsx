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
import { Customer } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STORAGE_KEYS } from "@/data/seed";
import { Search, Plus, User, Phone, Mail, MapPin, ShoppingBag, Edit2, Trash2 } from "lucide-react";

function CustomersContent() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (stored) setCustomers(JSON.parse(stored));
  }, []);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery)
  );

  const handleAddCustomer = (formData: any) => {
    const newCustomer: Customer = {
      ...formData,
      id: Math.random().toString(36).substring(2, 9),
      totalSpent: 0,
      totalPurchases: 0,
      isActive: true,
      createdAt: new Date(),
    };
    const updated = [...customers, newCustomer];
    setCustomers(updated);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
    setShowAddModal(false);
    showToast("Cliente agregado exitosamente", "success");
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
            <p className="text-slate-500 dark:text-slate-400">
              {customers.length} clientes registrados
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="w-5 h-5" />}>
            Agregar cliente
          </Button>
        </div>

        <Card>
          <div className="p-4">
            <Input
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} hover>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {customer.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {customer.totalPurchases} compras
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-slate-500">Total gastado</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(customer.totalSpent)}
                      </p>
                    </div>
                    {customer.lastPurchase && (
                      <Badge variant="secondary" size="sm">
                        Última: {formatDate(customer.lastPurchase)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Agregar cliente">
          <CustomerForm onSubmit={handleAddCustomer} onCancel={() => setShowAddModal(false)} />
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

function CustomerForm({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    rfc: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Input
        label="Teléfono"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <Input
        label="Dirección"
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
      />
      <Input
        label="RFC"
        value={formData.rfc}
        onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
      />
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar cliente</Button>
      </div>
    </form>
  );
}

export default function CustomersPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <CustomersContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
