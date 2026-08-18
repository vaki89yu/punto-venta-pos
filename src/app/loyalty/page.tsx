"use client";

import React, { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Avatar } from "@/components/ui/Avatar";
import { Customer } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { STORAGE_KEYS } from "@/data/seed";
import { Award, Star, Gift, TrendingUp, Crown, Medal } from "lucide-react";

// 1 punto por cada $10 pesos gastados
const POINTS_PER_PESO = 0.1;

interface LoyaltyLevel {
  name: string;
  minPoints: number;
  color: string;
  icon: any;
  benefits: string[];
}

const LOYALTY_LEVELS: LoyaltyLevel[] = [
  { name: "Bronce", minPoints: 0, color: "from-amber-600 to-amber-700", icon: Medal, benefits: ["5% descuento en cumpleaños"] },
  { name: "Plata", minPoints: 100, color: "from-slate-400 to-slate-500", icon: Star, benefits: ["5% descuento en cumpleaños", "Envío gratis"] },
  { name: "Oro", minPoints: 300, color: "from-yellow-400 to-yellow-600", icon: Crown, benefits: ["10% descuento en cumpleaños", "Envío gratis", "Acceso a ofertas exclusivas"] },
  { name: "Diamante", minPoints: 600, color: "from-cyan-400 to-blue-500", icon: Award, benefits: ["15% descuento en cumpleaños", "Envío gratis", "Ofertas exclusivas", "Atención prioritaria"] },
];

function getLoyaltyLevel(points: number): LoyaltyLevel {
  return [...LOYALTY_LEVELS].reverse().find(l => points >= l.minPoints) || LOYALTY_LEVELS[0];
}

function getNextLevel(points: number): LoyaltyLevel | null {
  return LOYALTY_LEVELS.find(l => l.minPoints > points) || null;
}

function LoyaltyContent() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (stored) setCustomers(JSON.parse(stored));
  }, []);

  const customersWithPoints = customers.map(c => ({
    ...c,
    points: Math.floor(c.totalSpent * POINTS_PER_PESO),
  })).sort((a, b) => b.points - a.points);

  const totalPointsIssued = customersWithPoints.reduce((sum, c) => sum + c.points, 0);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Programa de Lealtad</h1>
          <p className="text-slate-500">Puntos y recompensas para clientes frecuentes</p>
        </div>

        {/* Explicación del programa */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">¿Cómo funciona?</h3>
                <p className="text-slate-500">
                  Los clientes ganan <span className="font-semibold text-emerald-600">1 punto por cada $10 MXN</span> gastados.
                  Acumula puntos para subir de nivel y desbloquear beneficios exclusivos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Niveles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LOYALTY_LEVELS.map((level) => {
            const Icon = level.icon;
            const count = customersWithPoints.filter(c => getLoyaltyLevel(c.points).name === level.name).length;
            return (
              <Card key={level.name} hover>
                <CardContent className="p-5">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-800">{level.name}</h3>
                  <p className="text-sm text-slate-500">{level.minPoints}+ puntos</p>
                  <p className="text-2xl font-bold text-slate-800 mt-2">{count}</p>
                  <p className="text-xs text-slate-400">clientes</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Puntos Emitidos</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{totalPointsIssued.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Clientes en el Programa</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{customersWithPoints.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Valor en Recompensas</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{formatCurrency(totalPointsIssued * 1)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Ranking de clientes */}
        <Card>
          <CardHeader title="Ranking de Clientes VIP" subtitle="Los clientes con más puntos acumulados" />
          <CardContent>
            <div className="space-y-3">
              {customersWithPoints.slice(0, 10).map((customer, index) => {
                const level = getLoyaltyLevel(customer.points);
                const nextLevel = getNextLevel(customer.points);
                const Icon = level.icon;
                const progress = nextLevel
                  ? ((customer.points - level.minPoints) / (nextLevel.minPoints - level.minPoints)) * 100
                  : 100;

                return (
                  <div key={customer.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-8 text-center font-bold text-slate-400">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                      {index > 2 && `#${index + 1}`}
                    </div>
                    <Avatar name={customer.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{customer.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className={`bg-gradient-to-r ${level.color} text-white border-0`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {level.name}
                        </Badge>
                        <span className="text-xs text-slate-400">{formatCurrency(customer.totalSpent)} gastados</span>
                      </div>
                      {nextLevel && (
                        <div className="mt-2">
                          <Progress value={progress} size="sm" color="green" />
                          <p className="text-xs text-slate-400 mt-1">
                            {nextLevel.minPoints - customer.points} puntos para {nextLevel.name}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">{customer.points}</p>
                      <p className="text-xs text-slate-400">puntos</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}

export default function LoyaltyPage() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <LoyaltyContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
