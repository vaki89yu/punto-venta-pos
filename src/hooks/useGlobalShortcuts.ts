"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES: Record<string, string> = {
  F1: "/pos",
  F5: "/inventory",
  F6: "/customers",
  F7: "/sales",
  F8: "/cash",
};

export function useGlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const route = ROUTES[e.key];
      if (route) {
        e.preventDefault();
        router.push(route);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}
