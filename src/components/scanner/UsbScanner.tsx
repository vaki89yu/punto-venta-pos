"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Usb } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createUsbInputReader } from "@/lib/usbInputReader";
import type { ScanFeedback } from "./BarcodeScanner";

interface UsbScannerProps {
  onClose: () => void;
  onScan: (code: string) => void;
  feedback: ScanFeedback | null;
}

/** Se monta sólo mientras el modo USB está abierto y no hay otro diálogo. */
export function UsbScanner({ onClose, onScan, feedback }: UsbScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<ReturnType<typeof createUsbInputReader> | null>(null);
  const [automatic, setAutomatic] = useState(true);
  const [testOnly, setTestOnly] = useState(false);
  const [focused, setFocused] = useState(false);
  const [lastRead, setLastRead] = useState<{ code: string; test: boolean; count: number } | null>(null);

  const receiveCode = useEffectEvent((code: string) => {
    if (inputRef.current) inputRef.current.value = "";
    setLastRead((previous) => ({ code, test: testOnly, count: (previous?.count ?? 0) + 1 }));
    if (!testOnly) onScan(code);
  });

  useEffect(() => {
    const reader = createUsbInputReader((code) => receiveCode(code), automatic ? 800 : null);
    readerRef.current = reader;
    const input = inputRef.current;
    if (input) {
      input.value = "";
      input.focus();
    }
    const pause = () => reader.pause();
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", pause);
    return () => {
      reader.dispose();
      readerRef.current = null;
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", pause);
    };
  }, [automatic, testOnly]);

  return (
    <Modal isOpen onClose={onClose} title="Escáner USB · Nextep / teclado HID" size="lg">
      <div className="space-y-4" onClick={(event) => {
        // Un clic en las instrucciones no deja al lector escribiendo fuera del campo.
        if (event.target instanceof HTMLElement && !event.target.closest("button, input, select, label, a")) {
          inputRef.current?.focus();
        }
      }}>
        <p className="text-sm text-slate-600">
          Conecta tu lector, apunta a la etiqueta impresa del producto y presiona el gatillo.
          No necesitas encender la cámara.
        </p>
        <div className={`rounded-xl p-3 flex items-center gap-2 ${focused ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`} role="status">
          <Usb className="w-5 h-5 shrink-0" />
          {focused ? "Campo listo: escanea un producto" : "Lectura pausada: pulsa el campo o «Continuar escaneando»"}
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          readerRef.current?.submit();
          inputRef.current?.focus();
        }} className="space-y-3">
          <Input
            ref={inputRef}
            aria-label="Lectura del escáner USB"
            placeholder="Aquí aparecerá el código que envía tu lector"
            autoComplete="off"
            spellCheck={false}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              readerRef.current?.pause();
            }}
            onChange={(event) => readerRef.current?.update(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" || (event.key === "Tab" && event.currentTarget.value.trim())) {
                event.preventDefault();
                event.stopPropagation();
                readerRef.current?.submit();
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="success" onClick={() => inputRef.current?.focus()}>
              Continuar escaneando
            </Button>
            <Button type="submit" variant="secondary">Procesar código</Button>
          </div>
        </form>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} className="mt-1" />
          <span>Leer también sin Enter: procesar tras 0.8 segundos sin recibir caracteres.
            <span className="block text-xs text-slate-500">Desactívalo para escribir manualmente o si el lector hace pausas largas. Con Enter o Tab la lectura se procesa inmediatamente.</span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={testOnly} onChange={(event) => setTestOnly(event.target.checked)} />
          Probar lector sin agregar productos al carrito
        </label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" role="status" aria-live="polite">
          {lastRead ? <>
            <p className="font-semibold">Código recibido {lastRead.test ? "(prueba, no agregado)" : ""} · Lectura {lastRead.count}</p>
            <p className="font-mono break-all">{lastRead.code}</p>
            {!lastRead.test && feedback?.type === "found" && <p className="text-emerald-700">Agregado: {feedback.product?.name}</p>}
            {!lastRead.test && feedback?.type === "outofstock" && <p className="text-red-700">Sin existencias: {feedback.product?.name}</p>}
          </> : <p>Aún no se ha recibido un código. Este panel muestra lo que realmente envía el lector, no una conexión USB detectada.</p>}
        </div>
        <div className="text-xs text-slate-600 space-y-2">
          <p>Se aceptan letras, números, guiones y símbolos que envíe el lector. Los formatos disponibles dependen de su hardware; para códigos 2D usa la cámara o un lector 2D compatible.</p>
          <p><strong>¿No aparece ningún código?</strong> Abre el Bloc de notas y escanea una etiqueta impresa. Si tampoco escribe ahí, revisa el cable, otro puerto USB y el modo USB teclado (HID) del lector.</p>
          <p>Si no funciona, indícanos el modelo exacto de Nextep que aparece en su etiqueta y si escribe en el Bloc de notas. No uses códigos de configuración de otro modelo.</p>
        </div>
      </div>
    </Modal>
  );
}
