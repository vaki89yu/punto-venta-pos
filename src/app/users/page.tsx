"use client";

import React, { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { User, UserRole } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { generateId, formatDate } from "@/lib/utils";
import { Plus, Shield, Trash2, Edit2, CheckCircle, XCircle, Users as UsersIcon, Lock } from "lucide-react";

const ROLE_INFO: Record<UserRole, { label: string; color: string; modules: string[] }> = {
  admin: {
    label: "Administrador",
    color: "from-rose-500 to-red-600",
    modules: ["Todo el sistema", "Usuarios", "Configuración", "Reportes"],
  },
  manager: {
    label: "Gerente",
    color: "from-violet-500 to-purple-600",
    modules: ["Ventas", "Inventario", "Clientes", "Reportes", "Caja"],
  },
  cashier: {
    label: "Cajero",
    color: "from-emerald-500 to-teal-600",
    modules: ["Punto de venta", "Caja", "Clientes"],
  },
  inventory: {
    label: "Inventario",
    color: "from-amber-500 to-orange-600",
    modules: ["Inventario", "Productos", "Proveedores"],
  },
};

function UsersContent() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "cashier" as UserRole });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    if (stored) setUsers(JSON.parse(stored));
  }, []);

  const saveUsers = (data: User[]) => {
    setUsers(data);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "cashier" });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: u.password, role: u.role });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      showToast("Completa todos los campos", "warning");
      return;
    }

    if (editing) {
      saveUsers(users.map(u => u.id === editing.id ? { ...u, ...form, updatedAt: new Date() } : u));
      showToast("Usuario actualizado", "success");
    } else {
      if (users.some(u => u.email === form.email)) {
        showToast("Ya existe un usuario con ese correo", "error");
        return;
      }
      const newUser: User = {
        id: generateId(),
        ...form,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      saveUsers([...users, newUser]);
      showToast("Usuario creado exitosamente", "success");
    }
    setShowModal(false);
  };

  const toggleActive = (id: string) => {
    if (id === currentUser?.id) {
      showToast("No puedes desactivar tu propio usuario", "warning");
      return;
    }
    saveUsers(users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));
    showToast("Estado actualizado", "info");
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) {
      showToast("No puedes eliminar tu propio usuario", "warning");
      return;
    }
    if (confirm("¿Eliminar este usuario?")) {
      saveUsers(users.filter(u => u.id !== id));
      showToast("Usuario eliminado", "info");
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Usuarios y Roles</h1>
            <p className="text-slate-500">Administra el acceso al sistema</p>
          </div>
          <Button onClick={openCreate} leftIcon={<Plus className="w-5 h-5" />}>
            Nuevo Usuario
          </Button>
        </div>

        {/* Roles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(ROLE_INFO) as UserRole[]).map(role => {
            const info = ROLE_INFO[role];
            const count = users.filter(u => u.role === role).length;
            return (
              <Card key={role} hover>
                <CardContent className="p-5">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center mb-3`}>
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900">{info.label}</h3>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{count}</p>
                  <div className="mt-3 space-y-1">
                    {info.modules.map(m => (
                      <p key={m} className="text-xs text-slate-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" /> {m}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Lista */}
        <Card>
          <CardHeader title="Usuarios del Sistema" subtitle={`${users.length} usuarios registrados`} />
          <CardContent>
            <div className="space-y-3">
              {users.map(u => {
                const info = ROLE_INFO[u.role];
                return (
                  <div key={u.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Avatar name={u.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate">{u.name}</p>
                        {u.id === currentUser?.id && (
                          <Badge variant="info" size="sm">Tú</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{u.email}</p>
                      <p className="text-xs text-slate-400">Creado {formatDate(u.createdAt)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${info.color}`}>
                        <Shield className="w-3 h-3" /> {info.label}
                      </span>
                    </div>
                    <Badge variant={u.isActive ? "success" : "danger"}>
                      {u.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    <div className="flex gap-1">
                      <button onClick={() => toggleActive(u.id)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg" title="Activar/Desactivar">
                        {u.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Usuario" : "Nuevo Usuario"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nombre completo *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Correo electrónico *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Contraseña *"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Rol</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ROLE_INFO) as UserRole[]).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({ ...form, role })}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      form.role === role ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="font-semibold text-sm text-slate-900">{ROLE_INFO[role].label}</p>
                    <p className="text-xs text-slate-500">{ROLE_INFO[role].modules.length} módulos</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" fullWidth>
                {editing ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </ProtectedLayout>
  );
}

export default function UsersPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <UsersContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
