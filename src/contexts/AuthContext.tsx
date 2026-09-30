"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasPermission: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ApiErrorPayload = { error?: { message?: string } };
async function getError(response: Response) {
  const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
  return payload?.error?.message || `Error del servidor (${response.status}).`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await getError(response));
        return response.json() as Promise<{ user: User | null }>;
      })
      .then((result) => { if (active) { setUser(result.user); setError(null); } })
      .catch((cause: unknown) => {
        if (active) {
          setUser(null);
          setError(cause instanceof Error ? cause.message : "No se pudo validar la sesión.");
        }
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(await getError(response));
      const result = await response.json() as { user: User };
      setUser(result.user);
      setIsLoading(false);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      setUser(null);
    }
  };

  const hasPermission = useMemo(() => {
    const permissions: Record<User["role"], string[]> = {
      admin: ["dashboard", "pos", "inventory", "products", "sales", "customers", "suppliers", "reports", "cash", "settings", "users", "operations"],
      manager: ["dashboard", "pos", "inventory", "products", "sales", "customers", "suppliers", "reports", "cash", "operations"],
      cashier: ["pos", "cash", "customers", "sales"],
      inventory: ["inventory", "products", "suppliers", "operations"],
    };
    return (module: string) => Boolean(user && permissions[user.role]?.includes(module));
  }, [user]);

  return <AuthContext.Provider value={{ user, isLoading, error, login, logout, hasPermission }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
