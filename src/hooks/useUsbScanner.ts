"use client";

import { useEffect, useEffectEvent } from "react";
import { listenForUsbScanner } from "@/lib/usbScanner";

export function useUsbScanner(onScan: (code: string) => void, enabled: boolean) {
  // Mantiene el listener y su buffer entre renders, con el callback actualizado.
  const handleScan = useEffectEvent(onScan);

  useEffect(() => {
    if (!enabled) return;
    return listenForUsbScanner(window, {
      onScan: (code) => handleScan(code),
      shouldIgnore: (event) => {
        // No alterar cantidades, búsquedas, formularios ni diálogos abiertos.
        // El campo de código dedicado tiene su propio Enter/Tab sin límite de ritmo.
        const element = event.target;
        return !!document.querySelector('[role="dialog"]') ||
          (element instanceof HTMLElement && (
            element.isContentEditable ||
            !!element.closest('input, textarea, select, [role="textbox"]')
          ));
      },
    });
  }, [enabled]);
}
