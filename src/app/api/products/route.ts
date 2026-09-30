import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { barcodeVariants, normalizeBarcode } from "@/lib/barcodes";
import { auditEvents, categories, inventoryMovements, products, storeSettings } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { mapProduct } from "@/lib/server/mappers";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const productSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(5000).optional().nullable(),
  sku: z.string().trim().max(100).optional(),
  barcode: z.string().trim().min(1).max(100),
  categoryId: z.string().uuid().optional().nullable().or(z.literal("")),
  brand: z.string().max(100).optional().nullable(),
  image: z.string().max(2000).optional().nullable(),
  purchasePrice: z.number().finite().min(0),
  salePrice: z.number().finite().min(0),
  discountPrice: z.number().finite().min(0).optional().nullable(),
  stock: z.number().finite().min(0).max(1_000_000),
  minStock: z.number().finite().min(0).max(1_000_000),
  unit: z.string().trim().min(1).max(50),
  supplierId: z.string().uuid().optional().nullable().or(z.literal("")),
  tax: z.number().finite().min(0).max(100),
  isActive: z.boolean().default(true),
  marginOverrideReason: z.string().trim().min(3).max(500).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const db = getDb();
    const rows = await db.select({ product: products, category: categories })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.createdAt))
      .limit(5000);
    return Response.json({ products: rows.map(({ product, category }) => mapProduct(product, category)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const input = await readJson(request, productSchema);
    const db = getDb();
    const sku = input.sku?.trim() || `POS-${randomUUID().slice(0, 8).toUpperCase()}`;
    const barcode = normalizeBarcode(input.barcode);
    const product = await db.transaction(async (tx) => {
      const [settings] = await tx.select({ minimumGrossMarginPercent: storeSettings.minimumGrossMarginPercent }).from(storeSettings).limit(1);
      const marginFloor = settings ? Number(settings.minimumGrossMarginPercent) : 10;
      const margin = input.salePrice > 0 ? ((input.salePrice - input.purchasePrice) / input.salePrice) * 100 : -100;
      const [duplicateBarcode] = await tx.select({ id: products.id }).from(products).where(inArray(products.barcode, barcodeVariants(barcode))).limit(1);
      if (duplicateBarcode) throw new ApiError(409, "DUPLICATE_BARCODE", "Ese código de barras ya pertenece a otro producto.");
      if (input.isActive && margin < marginFloor && (user.role === "inventory" || !input.marginOverrideReason)) {
        throw new ApiError(403, "MARGIN_FLOOR", `Margen ${margin.toFixed(1)}% debajo del mínimo ${marginFloor}%. Se requiere permiso de gerencia y motivo.`);
      }
      const [created] = await tx.insert(products).values({
        name: input.name,
        description: input.description || null,
        sku,
        barcode,
        categoryId: input.categoryId || null,
        brand: input.brand || null,
        image: input.image || null,
        purchasePrice: input.purchasePrice.toFixed(2),
        salePrice: input.salePrice.toFixed(2),
        discountPrice: input.discountPrice == null ? null : input.discountPrice.toFixed(2),
        stock: input.stock.toFixed(3),
        minStock: input.minStock.toFixed(3),
        unit: input.unit,
        supplierId: input.supplierId || null,
        tax: input.tax.toFixed(2),
        isActive: input.isActive,
      }).returning();
      if (input.stock > 0) {
        await tx.insert(inventoryMovements).values({
          productId: created.id,
          type: "in",
          quantity: input.stock.toFixed(3),
          previousStock: "0",
          newStock: input.stock.toFixed(3),
          reason: "Existencia inicial al crear producto",
          userId: user.id,
        });
      }
      await tx.insert(auditEvents).values({
        actorId: user.id,
        actorName: user.name,
        action: "product.created",
        entityType: "product",
        entityId: created.id,
        summary: `Producto creado: ${created.name}.`,
        metadata: { stock: input.stock, price: input.salePrice, marginPercent: Number(margin.toFixed(2)), marginOverrideReason: input.marginOverrideReason || null },
      });
      const [category] = created.categoryId ? await tx.select().from(categories).where(eq(categories.id, created.categoryId)).limit(1) : [];
      return mapProduct(created, category);
    });
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "23505") {
      return jsonError(new ApiError(409, "DUPLICATE_PRODUCT", "Ya existe un producto con ese SKU."));
    }
    return jsonError(error);
  }
}
