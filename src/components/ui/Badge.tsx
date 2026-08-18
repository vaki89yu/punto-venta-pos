"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary";
  size?: "sm" | "md";
}

export function Badge({ 
  children, 
  variant = "default", 
  size = "sm",
  className, 
  ...props 
}: BadgeProps) {
  const variants = {
    default: "bg-blue-50 text-blue-600 border border-blue-100",
    success: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    warning: "bg-amber-50 text-amber-600 border border-amber-100",
    danger: "bg-red-50 text-red-600 border border-red-100",
    info: "bg-sky-50 text-sky-600 border border-sky-100",
    secondary: "bg-slate-100 text-slate-600 border border-slate-200",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
