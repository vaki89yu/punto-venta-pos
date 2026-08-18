"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Keyboard, Command } from "lucide-react";

const SHORTCUTS = [
  { group: "Navegación", items: [
    { keys: ["F1"], desc: "Nueva venta (POS)" },
    { keys: ["F5"], desc: "Inventario" },
    { keys: ["F6"], desc: "Clientes" },
    { keys: ["F7"], desc: "Ventas" },
    { keys: ["F8"], desc: "Caja" },
  ]},
  { group: "Punto de Venta", items: [
    { keys: ["F2"], desc: "Buscar producto" },
    { keys: ["F3"], desc: "Escanear código de barras" },
    { keys: ["F4"], desc: "Cobrar / Checkout" },
  ]},
  { group: "General", items: [
    { keys: ["Ctrl", "K"], desc: "Búsqueda global" },
    { keys: ["Shift", "?"], desc: "Mostrar esta ayuda" },
    { keys: ["Esc"], desc: "Cerrar modal / ventana" },
  ]},
];

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
      if (!typing && e.shiftKey && e.key === "?") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Atajos de teclado (Shift + ?)"
        className="hidden lg:flex fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-slate-900 text-white shadow-xl shadow-black/20 hover:bg-slate-800 hover:scale-105 transition-all items-center justify-center"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Atajos de teclado" size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                {group.group}
              </h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.desc} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">{item.desc}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 text-sm text-blue-700">
          <Command className="w-4 h-4 flex-shrink-0" />
          En Mac usa <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs">⌘</kbd> en lugar de Ctrl.
        </div>
      </Modal>
    </>
  );
}
