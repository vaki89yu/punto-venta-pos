import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, categories, inventoryMovements, products, saleItems, storeSettings } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { mapProduct } from "@/lib/server/mappers";
import { requireRole } from "@/lib/server/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  barcode: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().nullable().or(z.literal("")).optional(),
  brand: z.string().max(100).nullable().optional(),
  image: z.string().max(2000).nullable().optional(),
  purchasePrice: z.number().finite().min(0).optional(),
  salePrice: z.number().finite().min(0).optional(),
  discountPrice: z.number().finite().min(0).nullable().optional(),
  stock: z.number().finite().min(0).max(1_000_000).optional(),
  stockReason: z.string().trim().min(3).max(500).optional(),
  marginOverrideReason: z.string().trim().min(3).max(500).optional(),
  minStock: z.number().finite().min(0).max(1_000_000).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  supplierId: z.string().uuid().nullable().or(z.literal("")).optional(),
  tax: z.number().finite().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const { id } = await context.params;
    const input = await readJson(request, updateSchema);
    const { stock, stockReason, marginOverrideReason, ...fields } = input;
    if (stock !== undefined && !stockReason) throw new ApiError(400, "STOCK_REASON_REQUIRED", "Indica el motivo del ajuste de existencia.");
    if ((fields.salePrice !== undefined || fields.purchasePrice !== undefined) && user.role === "inventory") {
      throw new ApiError(403, "PRICE_PERMISSION_REQUIRED", "Solo administración o gerencia puede cambiar precios.");
    }
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(products).where(eq(products.id, id)).for("update").limit(1);
      if (!before) throw new ApiError(404, "PRODUCT_NOT_FOUND", "No se encontró el producto.");
      const nextCost = fields.purchasePrice ?? Number(before.purchasePrice);
      const nextPrice = fields.salePrice ?? Number(before.salePrice);
      const nextActive = fields.isActive ?? before.isActive;
      const [settings] = await tx.select({ minimumGrossMarginPercent: storeSettings.minimumGrossMarginPercent }).from(storeSettings).limit(1);
      const marginFloor = settings ? Number(settings.minimumGrossMarginPercent) : 10;
      const margin = nextPrice > 0 ? ((nextPrice - nextCost) / nextPrice) * 100 : -100;
      const isPriceChange = fields.purchasePrice !== undefined || fields.salePrice !== undefined;
      if (isPriceChange && nextActive && margin < marginFloor && (user.role === "inventory" || !marginOverrideReason)) {
        throw new ApiError(403, "MARGIN_FLOOR", `Margen ${margin.toFixed(1)}% debajo del mínimo ${marginFloor}%. Se requiere permiso de gerencia y motivo.`);
      }
      const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
      if (fields.name !== undefined) patch.name = fields.name;
      if (fields.description !== undefined) patch.description = fields.description;
      if (fields.sku !== undefined) patch.sku = fields.sku;
      if (fields.barcode !== undefined) patch.barcode = fields.barcode;
      if (fields.categoryId !== undefined) patch.categoryId = fields.categoryId || null;
      if (fields.brand !== undefined) patch.brand = fields.brand;
      if (fields.image !== undefined) patch.image = fields.image;
      if (fields.purchasePrice !== undefined) patch.purchasePrice = fields.purchasePrice.toFixed(2);
      if (fields.salePrice !== undefined) patch.salePrice = fields.salePrice.toFixed(2);
      if (fields.discountPrice !== undefined) patch.discountPrice = fields.discountPrice == null ? null : fields.discountPrice.toFixed(2);
      if (fields.minStock !== undefined) patch.minStock = fields.minStock.toFixed(3);
      if (fields.unit !== undefined) patch.unit = fields.unit;
      if (fields.supplierId !== undefined) patch.supplierId = fields.supplierId || null;
      if (fields.tax !== undefined) patch.tax = fields.tax.toFixed(2);
      if (fields.isActive !== undefined) patch.isActive = fields.isActive;
      if (stock !== undefined) patch.stock = stock.toFixed(3);

      const [updated] = await tx.update(products).set(patch).where(eq(products.id, id)).returning();
      if (stock !== undefined && stock !== Number(before.stock)) {
        const delta = stock - Number(before.stock);
        await tx.insert(inventoryMovements).values({
          productId: id,
          type: delta > 0 ? "in" : "out",
          quantity: Math.abs(delta).toFixed(3),
          previousStock: String(before.stock),
          newStock: stock.toFixed(3),
          reason: stockReason!,
          userId: user.id,
        });
      }
      const changedFields = Object.keys(input).filter((key) => !["stockReason", "marginOverrideReason"].includes(key));
      await tx.insert(auditEvents).values({
        actorId: user.id,
        actorName: user.name,
        action: marginOverrideReason && isPriceChange && margin < marginFloor ? "margin.guard.override" : stock !== undefined && stock !== Number(before.stock) ? "inventory.stock.adjusted" : "product.updated",
        entityType: "product",
        entityId: id,
        summary: `Producto actualizado: ${updated.name}; campos ${changedFields.join(", ")}.${marginOverrideReason ? ` Motivo: ${marginOverrideReason}` : ""}`,
        metadata: { changedFields: changedFields.join(", "), previousStock: Number(before.stock), stock: Number(updated.stock), marginPercent: Number(margin.toFixed(2)), marginFloor, marginOverrideReason: marginOverrideReason || null },
      });
      const [category] = updated.categoryId ? await tx.select().from(categories).where(eq(categories.id, updated.categoryId)).limit(1) : [];
      return mapProduct(updated, category);
    });
    return Response.json({ product: result });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "23505") {
      return jsonError(new ApiError(409, "DUPLICATE_PRODUCT", "El SKU ya está asignado a otro producto."));
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const { id } = await context.params;
    const db = getDb();
    const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!before) throw new ApiError(404, "PRODUCT_NOT_FOUND", "No se encontró el producto.");
    const [hasSales] = await db.select({ id: saleItems.id }).from(saleItems).where(eq(saleItems.productId, id)).limit(1);
    if (hasSales) {
      const [product] = await db.update(products).set({ isActive: false, updatedAt: new Date() }).where(eq(products.id, id)).returning();
      await db.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "product.archived", entityType: "product", entityId: id, summary: `Producto desactivado para conservar historial: ${before.name}.` });
      return Response.json({ product: mapProduct(product), archived: true });
    }
    await db.delete(products).where(eq(products.id, id));
    await db.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "product.deleted", entityType: "product", entityId: id, summary: `Producto eliminado: ${before.name}.` });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
