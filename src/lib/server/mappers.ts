import type { Product } from "@/types";
import type { categories, products } from "@/db/schema";

type ProductRow = typeof products.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;

export function mapProduct(row: ProductRow, category?: CategoryRow | null): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.categoryId || "",
    category: category ? {
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      color: category.color,
      icon: category.icon || undefined,
      createdAt: category.createdAt,
    } : undefined,
    brand: row.brand || undefined,
    image: row.image || undefined,
    purchasePrice: Number(row.purchasePrice),
    salePrice: Number(row.salePrice),
    discountPrice: row.discountPrice == null ? undefined : Number(row.discountPrice),
    stock: Number(row.stock),
    minStock: Number(row.minStock),
    unit: row.unit,
    supplierId: row.supplierId || undefined,
    tax: Number(row.tax),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
