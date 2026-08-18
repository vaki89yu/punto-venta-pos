"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-xl",
};

const colors = [
  "from-blue-400 to-blue-500",
  "from-emerald-400 to-emerald-500",
  "from-violet-400 to-violet-500",
  "from-amber-400 to-amber-500",
  "from-rose-400 to-rose-500",
  "from-cyan-400 to-cyan-500",
  "from-fuchsia-400 to-fuchsia-500",
  "from-orange-400 to-orange-500",
];

export function Avatar({ name, image, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Deterministic color based on name
  const colorIndex = name.charCodeAt(0) % colors.length;
  const colorClass = colors[colorIndex];

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={cn(
          "rounded-full object-cover border-2 border-white shadow-sm",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shadow-sm",
        "bg-gradient-to-br",
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

interface AvatarGroupProps {
  users: { name: string; image?: string }[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function AvatarGroup({ users, max = 4, size = "md" }: AvatarGroupProps) {
  const displayUsers = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex -space-x-2">
      {displayUsers.map((user, index) => (
        <div
          key={index}
          className="relative inline-block ring-2 ring-white rounded-full"
        >
          <Avatar name={user.name} image={user.image} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "relative inline-flex items-center justify-center rounded-full ring-2 ring-white bg-slate-100 text-slate-600 font-medium text-xs",
            size === "sm" && "w-8 h-8",
            size === "md" && "w-10 h-10",
            size === "lg" && "w-14 h-14"
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
