"use client";

import React, { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DatabaseTools } from "@/components/settings/DatabaseTools";
import { StoreSettings } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { Store, Moon, Sun, Monitor, Save, Receipt, Percent, DollarSign } from "lucide-react";

function SettingsContent() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<StoreSettings>({
    id: "settings-1",
    name: "Mi Tienda",
    taxRate: 16,
    currency: "MXN",
    theme: "system",
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      setSettings(JSON.parse(stored));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    showToast("Configuración guardada", "success");
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Personaliza tu punto de venta
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Información de la tienda" />
            <CardContent className="space-y-4">
              <Input
                label="Nombre de la tienda"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                leftIcon={<Store className="w-4 h-4" />}
              />
              <Input
                label="Dirección"
                value={settings.address || ""}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  value={settings.phone || ""}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
                <Input
                  label="Email"
                  value={settings.email || ""}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                />
              </div>
              <Input
                label="RFC"
                value={settings.rfc || ""}
                onChange={(e) => setSettings({ ...settings, rfc: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Configuración fiscal" />
            <CardContent className="space-y-4">
              <Input
                label="Tasa de impuesto (%)"
                type="number"
                value={settings.taxRate}
                onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
                leftIcon={<Percent className="w-4 h-4" />}
              />
              <Input
                label="Moneda"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                leftIcon={<DollarSign className="w-4 h-4" />}
              />
              <Input
                label="Mensaje en ticket"
                value={settings.ticketMessage || ""}
                onChange={(e) => setSettings({ ...settings, ticketMessage: e.target.value })}
                leftIcon={<Receipt className="w-4 h-4" />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Apariencia" />
            <CardContent>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
                Tema
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    theme === "light"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Sun className="w-6 h-6" />
                  <span className="text-sm font-medium">Claro</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    theme === "dark"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Moon className="w-6 h-6" />
                  <span className="text-sm font-medium">Oscuro</span>
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    theme === "system"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Monitor className="w-6 h-6" />
                  <span className="text-sm font-medium">Sistema</span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Acerca de" />
            <CardContent>
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Store className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Mi Tienda POS</h3>
                <p className="text-slate-500 dark:text-slate-400">Versión 1.0.0</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-4">
                  Sistema profesional de punto de venta
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DatabaseTools />

        <div className="flex justify-end">
          <Button onClick={handleSave} leftIcon={<Save className="w-5 h-5" />}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </ProtectedLayout>
  );
}

export default function SettingsPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <SettingsContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
