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
import { Store, Moon, Sun, Monitor, Save, Receipt, Percent, DollarSign } from "lucide-react";

function SettingsContent() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<StoreSettings>({ id: "", name: "", taxRate: 16, currency: "MXN", minimumGrossMarginPercent: 10, defaultCoverageDays: 14, defaultLeadTimeDays: 7, theme: "system" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as { settings?: StoreSettings; error?: { message?: string } } | null;
        if (!response.ok || !result?.settings) throw new Error(result?.error?.message || "No se pudo cargar la configuración de tienda.");
        if (active) { setSettings(result.settings); setTheme(result.settings.theme); }
      })
      .catch((error: unknown) => { if (active) showToast(error instanceof Error ? error.message : "No se pudo cargar la configuración.", "error"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [setTheme, showToast]);

  const handleSave = async () => {
    const floor = Number(settings.minimumGrossMarginPercent ?? 10);
    const coverage = Number(settings.defaultCoverageDays ?? 14);
    const lead = Number(settings.defaultLeadTimeDays ?? 7);
    if (!Number.isFinite(floor) || floor < 0 || floor > 90) {
      showToast("El margen mínimo debe estar entre 0% y 90%", "warning");
      return;
    }
    if (!Number.isInteger(coverage) || coverage < 1 || coverage > 180) {
      showToast("La cobertura objetivo debe ser de 1 a 180 días", "warning");
      return;
    }
    if (!Number.isInteger(lead) || lead < 0 || lead > 90) {
      showToast("El tiempo de entrega debe ser de 0 a 90 días", "warning");
      return;
    }
    if (!settings.id) return showToast("No hay una configuración de tienda cargada desde PostgreSQL.", "error");
    const nextSettings = { ...settings, theme, currency: "MXN" as const, minimumGrossMarginPercent: floor, defaultCoverageDays: coverage, defaultLeadTimeDays: lead };
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextSettings) });
      const result = await response.json().catch(() => null) as { settings?: StoreSettings; error?: { message?: string } } | null;
      if (!response.ok || !result?.settings) throw new Error(result?.error?.message || "No se pudo guardar la configuración.");
      setSettings(result.settings);
      showToast("Configuración guardada en PostgreSQL", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo guardar la configuración.", "error"); }
    finally { setIsSaving(false); }
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
            <CardHeader title="Política de margen y reposición" />
            <CardContent className="space-y-4">
              <Input
                label="Margen bruto mínimo (%)"
                type="number"
                min="0"
                max="90"
                step="0.5"
                value={settings.minimumGrossMarginPercent ?? 10}
                onChange={(e) => setSettings({ ...settings, minimumGrossMarginPercent: Number(e.target.value) })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Cobertura deseada (días)"
                  type="number"
                  min="1"
                  max="180"
                  step="1"
                  value={settings.defaultCoverageDays ?? 14}
                  onChange={(e) => setSettings({ ...settings, defaultCoverageDays: Number(e.target.value) })}
                />
                <Input
                  label="Entrega proveedor (días)"
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  value={settings.defaultLeadTimeDays ?? 7}
                  onChange={(e) => setSettings({ ...settings, defaultLeadTimeDays: Number(e.target.value) })}
                />
              </div>
              <p className="text-xs leading-5 text-slate-500">El margen se usa para limitar descuentos y alertar sobre precios bajos. La cobertura y entrega alimentan las sugerencias de compra del Radar.</p>
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

        <Card>
          <CardHeader title="Atribución de datos — Open Food Facts" />
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Este sistema puede enriquecer su inventario con datos de producto de{" "}
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:underline font-medium"
              >
                Open Food Facts
              </a>
              , contribución de miles de voluntarios.
            </p>
            <ul className="mt-3 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
              <li>Base de datos: <strong>Open Database License (ODbL) 1.0</strong></li>
              <li>Contenido de la base de datos: <strong>Database Contents License (DbCL) 1.0</strong></li>
              <li>Fotografías: <strong>Creative Commons Attribution-ShareAlike (CC BY-SA) 3.0</strong></li>
            </ul>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Los precios y existencias nunca provienen de Open Food Facts: son datos propios de la tienda.
            </p>
          </CardContent>
        </Card>

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
