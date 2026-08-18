"use client";

import React from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "blue" | "emerald" | "amber" | "rose" | "violet";
  onClick?: () => void;
}

const colorStyles = {
  blue: {
    bg: "bg-blue-50/80",
    icon: "text-blue-500",
    border: "border-blue-100",
  },
  emerald: {
    bg: "bg-emerald-50/80",
    icon: "text-emerald-500",
    border: "border-emerald-100",
  },
  amber: {
    bg: "bg-amber-50/80",
    icon: "text-amber-500",
    border: "border-amber-100",
  },
  rose: {
    bg: "bg-rose-50/80",
    icon: "text-rose-500",
    border: "border-rose-100",
  },
  violet: {
    bg: "bg-violet-50/80",
    icon: "text-violet-500",
    border: "border-violet-100",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
  onClick,
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-6 rounded-2xl border backdrop-blur-sm",
        "bg-white/90",
        styles.border,
        "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        "hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300",
        onClick && "cursor-pointer hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-emerald-500" : "text-red-500"
                )}
              >
                {trend.isPositive ? "↑" : "↓"}{trend.value}%
              </span>
              <span className="text-sm text-slate-400">vs ayer</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", styles.bg)}>
          <Icon className={cn("w-6 h-6", styles.icon)} />
        </div>
      </div>
    </div>
  );
}
