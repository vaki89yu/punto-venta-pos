"use client";

import React, { useState, useMemo } from "react";
import { Product, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Search, Package, Grid3X3, List } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Image from "next/image";

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  onAddToCart: (product: Product) => void;
}

export function ProductGrid({ products, categories, onAddToCart }: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(24);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode.includes(searchQuery);
      const matchesCategory = selectedCategory ? product.categoryId === selectedCategory : true;
      return matchesSearch && matchesCategory && product.isActive && product.stock > 0;
    });
  }, [products, searchQuery, selectedCategory]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 24);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search and filters */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre, SKU o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "grid" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setViewMode("grid")}
              leftIcon={<Grid3X3 className="w-4 h-4" />}
            />
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setViewMode("list")}
              leftIcon={<List className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? "text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              style={{
                backgroundColor: selectedCategory === category.id ? category.color : undefined,
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Package className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No se encontraron productos</p>
            <p className="text-sm">Intenta con otra búsqueda</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {displayedProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                className="group relative bg-white rounded-xl border border-slate-200/80 p-3 text-left hover:shadow-lg hover:border-blue-300 transition-shadow duration-150 gpu-accelerated"
              >
                <div className="aspect-square rounded-lg bg-slate-100 mb-3 overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-slate-700 text-sm line-clamp-2 mb-1">
                  {product.name}
                </h3>
                <p className="text-lg font-bold text-blue-500">
                  {formatCurrency(product.salePrice)}
                </p>
                <p className="text-xs text-slate-400">SKU: {product.sku}</p>
                {product.stock <= product.minStock && (
                  <Badge variant="warning" size="sm" className="absolute top-2 right-2">
                    Bajo stock
                  </Badge>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {displayedProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                className="w-full flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-200/80 hover:shadow-lg hover:border-blue-300 transition-all duration-150 gpu-accelerated"
              >
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-500">
                    SKU: {product.sku} | Stock: {product.stock}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(product.salePrice)}
                  </p>
                  {product.stock <= product.minStock && (
                    <Badge variant="warning" size="sm">Bajo stock</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Botón Cargar Más */}
        {visibleCount < filteredProducts.length && (
          <div className="mt-4 text-center">
            <button
              onClick={handleLoadMore}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              Cargar más ({filteredProducts.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
