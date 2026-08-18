"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface TopProductsChartProps {
  data: { name: string; sales: number; quantity: number }[];
}

const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:stroke-slate-700" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748B"
            className="dark:stroke-slate-400"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748B"
            className="dark:stroke-slate-400"
            tick={{ fontSize: 11 }}
            width={100}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{data.name}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                      {formatCurrency(data.sales)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {data.quantity} vendidos
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
