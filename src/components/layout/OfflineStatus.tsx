"use client";

import { useSyncExternalStore } from "react";
import { CloudOff, Wifi } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineStatus() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="status"
      aria-live="polite"
      title={online ? "La aplicación está en línea; los datos de demostración siguen en este dispositivo." : "Sin internet. La aplicación intentará abrir las pantallas guardadas en este dispositivo."}
      className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        online
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300"
          : "bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-300"
      }`}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
      {online ? "En línea · modo local" : "Sin conexión · modo local"}
    </div>
  );
}
