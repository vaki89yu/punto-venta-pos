"use client";

import React from "react";

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Imagen de fondo de supermercado/abarrotes - Optimizada */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat will-change-transform"
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=60")`,
          transform: 'translateZ(0)',
        }}
      />
      
      {/* Overlay para mejorar legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/90 to-blue-50/85" />
      
      {/* Patrón sutil de cuadrícula */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1e293b 1px, transparent 1px),
            linear-gradient(to bottom, #1e293b 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Círculos decorativos suaves */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-200/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4" />
      <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-amber-200/10 rounded-full blur-3xl" />
      
      {/* Líneas decorativas sutiles */}
      <div className="absolute top-20 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300/30 to-transparent" />
      <div className="absolute bottom-20 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300/30 to-transparent" />
    </div>
  );
}
