"use client";

import { useCallback, useEffect, useState } from "react";

export function useServerList<T>(url: string, responseKey: string) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = (payload?.error as { message?: string } | undefined)?.message;
      throw new Error(message || `No se pudieron cargar los datos (${response.status}).`);
    }
    const rows = payload?.[responseKey];
    const nextItems = Array.isArray(rows) ? rows as T[] : [];
    setItems(nextItems);
    setError(null);
    return nextItems;
  }, [url, responseKey]);

  useEffect(() => {
    let active = true;
    refresh().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  return { items, setItems, isLoading, error, refresh };
}
