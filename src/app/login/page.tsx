"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

import { Store, Sun, Moon, Eye, EyeOff, Lock, User as UserIcon, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: unknown | null }> : null)
      .then((result) => { if (active && result?.user) router.replace("/dashboard"); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setError(result?.error?.message || "No se pudo iniciar sesión. Revisa la configuración del servidor.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Background wallpaper - Tienda de abarrotes real */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80"
          alt="Tienda de abarrotes"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-800/60 to-emerald-900/50" />
      </div>
      
      {/* Left side - Content */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 overflow-hidden">
        <div className="relative z-20 flex flex-col justify-center px-16 text-white">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mb-10 border border-white/20">
            <Store className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-light mb-4 leading-tight">
            Sistema <span className="font-bold">POS</span>
          </h1>
          <h2 className="text-3xl font-light text-white/90 mb-8">
            Profesional para tu negocio
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-md leading-relaxed">
            Controla tu inventario, realiza ventas y gestiona tu tienda desde cualquier dispositivo con una interfaz moderna y fácil de usar.
          </p>
          <div className="flex gap-6">
            <div className="flex items-center gap-3 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="font-bold text-sm">1</span>
              </div>
              <span className="text-white/90 font-medium">Rápido</span>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="font-bold text-sm">2</span>
              </div>
              <span className="text-white/90 font-medium">Seguro</span>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="font-bold text-sm">3</span>
              </div>
              <span className="text-white/90 font-medium">Eficiente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 relative z-10">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/10 border border-white/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
              <Store className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Bienvenido</h2>
            <p className="text-slate-500 mt-1">
              Accede a tu Punto de Venta
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<UserIcon className="w-4 h-4" />}
              required
            />

            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300" />
                <span>Recordarme</span>
              </label>
              <Link
                href="#"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Iniciar sesión
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Acceso protegido por servidor</p>
            <p className="mt-1">No hay usuarios de muestra. La cuenta inicial la crea la persona administradora durante la instalación.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
