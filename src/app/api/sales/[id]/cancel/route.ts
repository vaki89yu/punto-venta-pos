import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, inventoryLots, inventoryMovements, products, returns, saleItems, sales } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager");
    const { id } = await context.params;
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).for("update").limit(1);
      if (!sale) throw new ApiError(404, "SALE_NOT_FOUND", "No se encontró la venta.");
      if (sale.status !== "completed") throw new ApiError(409, "SALE_NOT_CANCELLABLE", "Solo se pueden cancelar ventas completadas.");
      const [existingReturn] = await tx.select({ id: returns.id }).from(returns).where(eq(returns.saleId, id)).limit(1);
      if (existingReturn) throw new ApiError(409, "SALE_HAS_RETURNS", "No se puede cancelar una venta que ya tiene devoluciones.");
      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
      const totals = new Map<string, number>();
      for (const item of items) {
        totals.set(item.productId, (totals.get(item.productId) || 0) + Number(item.quantity));
        for (const allocation of item.lotAllocations || []) {
          const [lot] = await tx.select().from(inventoryLots).where(eq(inventoryLots.id, allocation.lotId)).for("update").limit(1);
          if (lot) {
            const restored = Number(lot.remainingQuantity) + Number(allocation.quantity);
            await tx.update(inventoryLots).set({ remainingQuantity: restored.toFixed(3) }).where(eq(inventoryLots.id, lot.id));
          }
        }
      }
      for (const [productId, quantity] of totals) {
        const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update").limit(1);
        if (!product) throw new ApiError(409, "PRODUCT_MISSING", "No se puede restituir un producto eliminado.");
        const previous = Number(product.stock);
        const next = previous + quantity;
        await tx.update(products).set({ stock: next.toFixed(3), updatedAt: new Date() }).where(eq(products.id, productId));
        await tx.insert(inventoryMovements).values({ productId, type: "return", quantity: quantity.toFixed(3), previousStock: previous.toFixed(3), newStock: next.toFixed(3), reason: `Cancelación de ticket ${sale.ticketNumber}`, saleId: sale.id, userId: user.id });
      }
      const [updated] = await tx.update(sales).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(sales.id, id), eq(sales.status, "completed"))).returning();
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "sale.cancelled", entityType: "sale", entityId: id, summary: `Venta ${sale.ticketNumber} cancelada y stock restituido.`, metadata: { amount: Number(sale.total), lineCount: items.length } });
      return { id: updated.id, ticketNumber: updated.ticketNumber, status: updated.status, updatedAt: updated.updatedAt };
    });
    return Response.json({ sale: result });
  } catch (error) { return jsonError(error); }
}
