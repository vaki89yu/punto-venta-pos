"use client";

import { useEffect, useCallback } from "react";

interface ShortcutConfig {
  key: string;
  callback: () => void;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  preventDefault?: boolean;
}

export function useShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    shortcuts.forEach((shortcut) => {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.callback();
      }
    });
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export const POS_SHORTCUTS = {
  NEW_SALE: { key: "F1", description: "Nueva venta" },
  SEARCH_PRODUCT: { key: "F2", description: "Buscar producto" },
  SCAN: { key: "F3", description: "Escanear" },
  CHECKOUT: { key: "F4", description: "Cobrar" },
  INVENTORY: { key: "F5", description: "Inventario" },
  CUSTOMERS: { key: "F6", description: "Clientes" },
  SALES: { key: "F7", description: "Ventas" },
  CASH: { key: "F8", description: "Caja" },
  CLOSE_MODAL: { key: "Escape", description: "Cerrar modal" },
  SEARCH: { key: "k", ctrl: true, description: "Búsqueda global" },
};
