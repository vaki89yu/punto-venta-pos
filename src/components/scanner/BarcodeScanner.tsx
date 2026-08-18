"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import { Result, DecodeHintType } from "@zxing/library";
import { X, Smartphone, Monitor, Zap, ScanLine, CheckCircle2, PackagePlus, ShoppingCart } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Product } from "@/types";

export interface ScanFeedback {
  type: "found" | "new" | "outofstock";
  product?: Product;
  barcode: string;
}

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  continuous?: boolean;
  feedback?: ScanFeedback | null;
  scannedCount?: number;
}

export function BarcodeScanner({
  isOpen,
  onClose,
  onScan,
  continuous = false,
  feedback = null,
  scannedCount = 0,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string>("");
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCodeRef = useRef<string>("");
  const lockRef = useRef<boolean>(false);

  // Ref siempre actualizado con el handler más reciente (evita stale closure)
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleScan = useCallback((raw: string) => {
    const barcode = (raw || "").trim();
    if (!barcode) return;

    // Anti-duplicado usando refs (no depende del ciclo de render)
    if (lockRef.current && lastCodeRef.current === barcode) return;

    lockRef.current = true;
    lastCodeRef.current = barcode;
    setLastCode(barcode);

    // Llama SIEMPRE al handler más reciente
    onScanRef.current(barcode);

    if (navigator.vibrate) navigator.vibrate(120);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      lockRef.current = false;
      lastCodeRef.current = "";
      scanTimeoutRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCameraError(null);
      return;
    }

    const getDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        stream.getTracks().forEach((t) => t.stop());

        const list = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = list.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);

        const backCamera = videoDevices.find((d) => {
          const l = d.label.toLowerCase();
          return l.includes("back") || l.includes("trasera") || l.includes("rear") || l.includes("environment");
        });
        setSelectedDevice(backCamera?.deviceId || videoDevices[videoDevices.length - 1]?.deviceId || "");
        setCameraError(null);
      } catch (error: any) {
        console.error("Error accessing camera:", error);
        setCameraError(
          error?.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador."
            : "No se pudo acceder a la cámara de este dispositivo."
        );
      }
    };

    getDevices();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedDevice) return;

    let cancelled = false;

    const startScanning = async () => {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        readerRef.current = reader;

        await reader.decodeFromVideoDevice(
          selectedDevice,
          videoRef.current!,
          (result: Result | undefined) => {
            if (result && !cancelled) {
              handleScan(result.getText());
            }
          }
        );

        if (!cancelled) setIsScanning(true);
      } catch (error) {
        console.error("Error starting scanner:", error);
        if (!cancelled) setCameraError("Error al iniciar la cámara. Intenta cerrar y abrir de nuevo.");
      }
    };

    startScanning();

    return () => {
      cancelled = true;
      if (readerRef.current) {
        (readerRef.current as any).reset?.();
        readerRef.current = null;
      }
      setIsScanning(false);
      lockRef.current = false;
      lastCodeRef.current = "";
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [isOpen, selectedDevice, handleScan]);

  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("back") || l.includes("front") || l.includes("trasera")) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" hideCloseButton>
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <ScanLine className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Escanear Código</h3>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                {continuous ? "Modo continuo activado" : "Apunta al código de barras"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de cámara */}
        {devices.length > 1 && (
          <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {devices.map((device, i) => (
              <button
                key={device.deviceId}
                onClick={() => setSelectedDevice(device.deviceId)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0",
                  selectedDevice === device.deviceId
                    ? "bg-blue-100 text-blue-700 font-semibold"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {getDeviceIcon(device.label)}
                <span className="max-w-[120px] truncate">{device.label || `Cámara ${i + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Error de cámara */}
        {cameraError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {cameraError}
          </div>
        )}

        {/* Cámara */}
        <div className="relative aspect-[4/3] sm:aspect-video bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            autoPlay
          />

          <div className="absolute inset-0 scanner-overlay pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-36">
              <div className="absolute top-0 left-0 w-7 h-7 border-l-4 border-t-4 border-blue-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-7 h-7 border-r-4 border-t-4 border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-l-4 border-b-4 border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-r-4 border-b-4 border-blue-400 rounded-br-lg" />
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
            </div>
          </div>

          {/* Estado */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full">
              <div
                className={cn("w-2 h-2 rounded-full animate-pulse", isScanning ? "bg-emerald-400" : "bg-amber-400")}
              />
              <span className="text-xs text-white font-medium">
                {isScanning ? "Buscando código..." : "Iniciando cámara..."}
              </span>
            </div>
            {lastCode && (
              <div className="px-3 py-1 bg-white/90 rounded-full">
                <span className="text-[11px] font-mono font-bold text-slate-800">{lastCode}</span>
              </div>
            )}
          </div>

          {/* Contador continuo */}
          {continuous && scannedCount > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-bold shadow-lg">
              <ShoppingCart className="w-3.5 h-3.5" />
              {scannedCount}
            </div>
          )}

          {/* Overlay de resultado */}
          {feedback && (
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm animate-fade-in px-4",
                feedback.type === "found" && "bg-emerald-600/90",
                feedback.type === "new" && "bg-blue-600/90",
                feedback.type === "outofstock" && "bg-red-600/90"
              )}
            >
              {feedback.type === "found" && (
                <>
                  <CheckCircle2 className="w-14 h-14 text-white" />
                  <p className="text-white font-bold text-lg text-center leading-tight">
                    {feedback.product?.name}
                  </p>
                  <p className="text-white/90 text-sm">
                    {formatCurrency(feedback.product?.salePrice || 0)} · Agregado al carrito
                  </p>
                </>
              )}
              {feedback.type === "new" && (
                <>
                  <PackagePlus className="w-14 h-14 text-white" />
                  <p className="text-white font-bold text-lg">Producto nuevo</p>
                  <p className="text-white/90 text-sm font-mono">{feedback.barcode}</p>
                  <p className="text-white/80 text-xs">Abriendo registro...</p>
                </>
              )}
              {feedback.type === "outofstock" && (
                <>
                  <X className="w-14 h-14 text-white" />
                  <p className="text-white font-bold text-lg text-center">{feedback.product?.name}</p>
                  <p className="text-white/90 text-sm">Sin stock disponible</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-[11px] sm:text-xs text-emerald-700 font-medium leading-tight">
              Ya registrado → al carrito
            </span>
          </div>
          <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
            <PackagePlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-[11px] sm:text-xs text-blue-700 font-medium leading-tight">
              Código nuevo → registrar
            </span>
          </div>
        </div>

        <div className="mt-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cerrar escáner
          </Button>
        </div>
      </div>
    </Modal>
  );
}
