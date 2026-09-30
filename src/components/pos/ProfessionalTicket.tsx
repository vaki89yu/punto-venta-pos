"use client";

import React, { useMemo, useRef, useSyncExternalStore } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { CartItem, Customer, PaymentMethod, StoreSettings } from "@/types";
import { STORAGE_KEYS } from "@/data/seed";
import { buildWhatsAppUrl, formatQuantity } from "@/lib/professionalFeatures";
import { Printer, Download, Share2, X, CheckCircle, Receipt, Store, Phone, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QRCodeSVG } from "qrcode.react";

interface ProfessionalTicketProps {
  ticketNumber: string;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  items: CartItem[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  onClose: () => void;
}

const DEFAULT_TICKET_SETTINGS: Partial<StoreSettings> = {
  name: "Abarrotes La Esquina",
  address: "",
  phone: "",
  email: "",
  rfc: "",
  ticketMessage: "¡Gracias por su compra! Vuelva pronto.",
};

function subscribeTicketSettings(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEYS.SETTINGS) callback();
  };
  const onLocalChange = (event: Event) => {
    const key = (event as CustomEvent<{ key?: string }>).detail?.key;
    if (!key || key === STORAGE_KEYS.SETTINGS) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pos:local-change", onLocalChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pos:local-change", onLocalChange);
  };
}

function getTicketSettingsSnapshot() {
  return localStorage.getItem(STORAGE_KEYS.SETTINGS) || "";
}

function getServerTicketSettingsSnapshot() {
  return "";
}

export function ProfessionalTicket({
  ticketNumber,
  total,
  subtotal,
  discount,
  tax,
  items,
  customer,
  paymentMethod,
  cashReceived,
  change,
  onClose,
}: ProfessionalTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const settingsSnapshot = useSyncExternalStore(subscribeTicketSettings, getTicketSettingsSnapshot, getServerTicketSettingsSnapshot);
  const storeSettings = useMemo(() => {
    try {
      return { ...DEFAULT_TICKET_SETTINGS, ...JSON.parse(settingsSnapshot) } as Partial<StoreSettings>;
    } catch {
      return DEFAULT_TICKET_SETTINGS;
    }
  }, [settingsSnapshot]);

  const handleDownloadPDF = async () => {
    if (!ticketRef.current) return;

    const canvas = await html2canvas(ticketRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      unit: "mm",
      format: [80, 150],
      orientation: "portrait",
    });

    const imgWidth = 80;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, 150));
    pdf.save(`ticket-${ticketNumber}.pdf`);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && ticketRef.current) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket ${ticketNumber}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .ticket { width: 80mm; font-family: Arial, sans-serif; }
              }
            </style>
          </head>
          <body>
            ${ticketRef.current.innerHTML}
            <script>window.onload = () => { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ticket ${ticketNumber}`,
          text: `Compra en ${storeSettings.name || "Mi Tienda"} por ${formatCurrency(total)}. Ticket ${ticketNumber}.`,
        });
      } catch {
        // The customer cancelled the native share sheet.
      }
    }
  };

  const handleWhatsAppShare = () => {
    const lines = items.map((item) => {
      const gross = item.product.salePrice * item.quantity;
      const net = gross * (1 - item.discount / 100);
      const lineTotal = net + net * (Math.max(0, item.product.tax || 0) / 100);
      return `• ${formatQuantity(item.quantity, item.product.unit)} ${item.product.name}: ${formatCurrency(lineTotal)}`;
    });
    const message = [
      `Hola${customer?.name ? ` ${customer.name}` : ""}, este es el resumen de tu compra en ${storeSettings.name || "Mi Tienda"}.`,
      `Ticket: ${ticketNumber}`,
      ...lines,
      `Total: ${formatCurrency(total)}`,
      storeSettings.phone ? `Tienda: ${storeSettings.phone}` : "",
      storeSettings.ticketMessage || "¡Gracias por tu compra!",
    ].filter(Boolean).join("\n");
    window.open(buildWhatsAppUrl(customer?.phone, message), "_blank", "noopener,noreferrer");
  };

  const getPaymentMethodText = (method: PaymentMethod) => {
    const methods: Record<string, string> = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      mixed: "Mixto",
      qr: "QR Code",
    };
    return methods[method] || method;
  };

  return (
    <div className="bg-white">
      {/* Ticket Content - Compacto para pantalla */}
      <div
        ref={ticketRef}
        className="p-4 max-w-xs mx-auto bg-white"
        style={{ fontFamily: "Arial, sans-serif", fontSize: "12px" }}
      >
        {/* Header con Logo - Compacto */}
        <div className="text-center border-b-2 border-dashed border-slate-300 pb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
            <Store className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">
            {storeSettings.name || "Mi Tienda"}
          </h1>
          <div className="mt-2 text-xs text-slate-600 space-y-0.5">
            {storeSettings.address && <p>{storeSettings.address}</p>}
            {storeSettings.phone && <p>Tel: {storeSettings.phone}</p>}
            {storeSettings.email && <p>{storeSettings.email}</p>}
            {storeSettings.rfc && <p>RFC: {storeSettings.rfc}</p>}
          </div>
        </div>

        {/* Información del Ticket - Compacto */}
        <div className="py-2 border-b border-dashed border-slate-300 text-xs">
          <div className="grid grid-cols-2 gap-1">
            <div>
              <span className="text-slate-500">Ticket:</span>
              <p className="font-mono font-bold text-slate-800 text-xs">{ticketNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Fecha:</span>
              <p className="font-semibold text-slate-800">{new Date().toLocaleDateString("es-MX")}</p>
            </div>
          </div>
          {customer && (
            <div className="mt-1 pt-1 border-t border-slate-100">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-semibold text-slate-800 ml-1">{customer.name}</span>
            </div>
          )}
        </div>

        {/* Productos - Compacto */}
        <div className="py-2 border-b border-dashed border-slate-300">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-1 text-slate-500 font-medium w-8">Cant</th>
                <th className="text-left py-1 text-slate-500 font-medium">Producto</th>
                <th className="text-right py-1 text-slate-500 font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 text-slate-800 font-medium">{formatQuantity(item.quantity, item.product.unit)}</td>
                  <td className="py-1 text-slate-700 text-xs">
                    {item.product.name.length > 20 ? item.product.name.substring(0, 20) + "..." : item.product.name}
                    {item.discount > 0 && <span className="block text-emerald-600">Descuento {item.discount}%</span>}
                  </td>
                  <td className="py-1 text-right font-mono font-semibold text-slate-800">
                    {formatCurrency(item.product.salePrice * item.quantity * (1 - item.discount / 100) * (1 + Math.max(0, item.product.tax || 0) / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales - Compacto */}
        <div className="py-2 border-b border-dashed border-slate-300 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Subtotal:</span>
            <span className="font-mono text-slate-700">{formatCurrency(subtotal + discount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-xs text-emerald-700">
              <span>Descuento:</span>
              <span className="font-mono">−{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Base después de descuento:</span>
            <span className="font-mono text-slate-700">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Impuestos:</span>
            <span className="font-mono text-slate-700">{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1 border-t border-slate-200">
            <span className="text-slate-800">TOTAL:</span>
            <span className="text-emerald-600">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Información de Pago - Compacto */}
        <div className="py-2 border-b border-dashed border-slate-300 text-xs">
          <div className="flex justify-between mb-1">
            <span className="text-slate-500">Pago:</span>
            <span className="font-semibold text-slate-800 capitalize">{getPaymentMethodText(paymentMethod)}</span>
          </div>
          {cashReceived && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Recibido:</span>
                <span className="font-mono text-slate-700">{formatCurrency(cashReceived)}</span>
              </div>
              {change && change > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cambio:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatCurrency(change)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* QR Code - Compacto */}
        <div className="py-3 text-center">
          <div className="inline-block p-2 bg-white rounded-lg shadow border border-slate-100">
            <QRCodeSVG
              value={ticketNumber}
              size={80}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Referencia del ticket · {ticketNumber}</p>
        </div>

        {/* Mensaje Final - Compacto */}
        <div className="text-center pt-3 border-t-2 border-dashed border-slate-300">
          <p className="text-sm font-bold text-slate-800">¡GRACIAS POR SU COMPRA!</p>
          <p className="text-xs text-slate-500">{storeSettings.ticketMessage || "Vuelva pronto"}</p>
        </div>
      </div>

      {/* Botones de Acción - Destacar Impresión */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        {/* Botón Imprimir destacado para el cliente */}
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all mb-2"
        >
          <Printer className="w-5 h-5" />
          Imprimir Ticket para Cliente
        </button>

        <button
          onClick={handleWhatsAppShare}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <MessageCircle className="h-5 w-5" />
          Enviar resumen por WhatsApp{customer?.phone ? ` · ${customer.phone}` : ""}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handlePrint}
            className="flex flex-col items-center justify-center gap-1 p-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
          >
            <Printer className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-slate-600">Reimprimir</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex flex-col items-center justify-center gap-1 p-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-600">PDF</span>
          </button>
          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center gap-1 p-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all"
          >
            <Share2 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-slate-600">Compartir</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all"
        >
          <CheckCircle className="w-5 h-5" />
          Nueva Venta
        </button>
      </div>
    </div>
  );
}
