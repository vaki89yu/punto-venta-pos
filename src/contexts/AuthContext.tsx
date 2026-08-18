"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types";
import { STORAGE_KEYS, initializeDemoData } from "@/data/seed";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeDemoData();
    const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
    const foundUser = users.find((u: User) => u.email === email && u.password === password);
    
    if (foundUser && foundUser.isActive) {
      setUser(foundUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  const hasPermission = (module: string): boolean => {
    if (!user) return false;
    
    const permissions: Record<string, string[]> = {
      admin: ["dashboard", "pos", "inventory", "sales", "customers", "suppliers", "reports", "cash", "settings", "users"],
      manager: ["dashboard", "pos", "inventory", "sales", "customers", "suppliers", "reports", "cash"],
      cashier: ["pos", "cash", "customers", "sales"],
      inventory: ["inventory", "suppliers", "products"],
    };
    
    return permissions[user.role]?.includes(module) || false;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
