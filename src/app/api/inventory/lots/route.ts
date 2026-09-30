import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, inventoryLots, inventoryMovements, products, users } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Fecha de vencimiento inválida.");

export async function GET() {
  try {
    await requireUser();
    const rows = await getDb().select({ lot: inventoryLots, product: products, user: users })
      .from(inventoryLots)
      .innerJoin(products, eq(inventoryLots.productId, products.id))
      .leftJoin(users, eq(inventoryLots.receivedBy, users.id))
      .orderBy(desc(inventoryLots.receivedAt))
      .limit(5000);
    return Response.json({ lots: rows.map(({ lot, product, user }) => ({
      id: lot.id,
      productId: lot.productId,
      productName: product.name,
      lotCode: lot.lotCode,
      quantity: Number(lot.remainingQuantity),
      receivedQuantity: Number(lot.receivedQuantity),
      expiresOn: lot.expiresAt || "",
      unitCost: Number(lot.unitCost),
      receivedAt: lot.receivedAt.toISOString(),
      receivedBy: user?.name || "Usuario",
      source: lot.source === "purchase" ? "purchase" : "opening",
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const lotSchema = z.object({
  productId: z.string().uuid(),
  lotCode: z.string().trim().min(1).max(100),
  quantity: z.number().finite().positive().max(1_000_000),
  expiresOn: dateSchema,
  unitCost: z.number().finite().min(0),
  addToStock: z.boolean(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const input = await readJson(request, lotSchema);
    const today = new Date().toISOString().slice(0, 10);
    if (input.addToStock && input.expiresOn < today) throw new ApiError(400, "EXPIRED_NEW_STOCK", "No se puede recibir como mercancía nueva un lote vencido.");
    const db = getDb();
    const lot = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).for("update").limit(1);
      if (!product || !product.isActive) throw new ApiError(404, "PRODUCT_NOT_FOUND", "No se encontró un producto activo.");
      const existingLots = await tx.select().from(inventoryLots).where(eq(inventoryLots.productId, product.id));
      if (existingLots.some((existing) => existing.lotCode.toLowerCase() === input.lotCode.toLowerCase())) throw new ApiError(409, "DUPLICATE_LOT", "Ese folio de lote ya existe para el producto.");
      const tracked = existingLots.reduce((sum, existing) => sum + Number(existing.remainingQuantity), 0);
      if (!input.addToStock && input.quantity > Math.max(0, Number(product.stock) - tracked) + 0.0001) {
        throw new ApiError(409, "LOT_STOCK_EXCEEDED", `Solo hay ${Math.max(0, Number(product.stock) - tracked)} unidades sin lote por asignar.`);
      }
      const [created] = await tx.insert(inventoryLots).values({
        productId: product.id,
        lotCode: input.lotCode,
        receivedQuantity: input.quantity.toFixed(3),
        remainingQuantity: input.quantity.toFixed(3),
        expiresAt: input.expiresOn,
        unitCost: input.unitCost.toFixed(2),
        source: input.addToStock ? "purchase" : "opening",
        receivedBy: user.id,
      }).returning();
      if (input.addToStock) {
        const oldStock = Number(product.stock);
        const newStock = oldStock + input.quantity;
        await tx.update(products).set({ stock: newStock.toFixed(3), updatedAt: new Date() }).where(eq(products.id, product.id));
        await tx.insert(inventoryMovements).values({ productId: product.id, type: "in", quantity: input.quantity.toFixed(3), previousStock: oldStock.toFixed(3), newStock: newStock.toFixed(3), reason: `Recepción del lote ${input.lotCode}`, userId: user.id });
      }
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "inventory.lot.created", entityType: "inventory_lot", entityId: created.id, summary: `Lote ${created.lotCode} registrado para ${product.name}; vence ${created.expiresAt}.`, metadata: { quantity: input.quantity, addedToStock: input.addToStock, expiresOn: input.expiresOn } });
      return { id: created.id, productId: created.productId, productName: product.name, lotCode: created.lotCode, quantity: Number(created.remainingQuantity), receivedQuantity: Number(created.receivedQuantity), expiresOn: created.expiresAt || "", unitCost: Number(created.unitCost), receivedAt: created.receivedAt.toISOString(), receivedBy: user.name, source: input.addToStock ? "purchase" : "opening" };
    });
    return Response.json({ lot }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "23505") return jsonError(new ApiError(409, "DUPLICATE_LOT", "Ese folio de lote ya existe para el producto."));
    return jsonError(error);
  }
}
