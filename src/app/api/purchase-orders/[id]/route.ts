import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, inventoryLots, inventoryMovements, products, purchaseOrderItems, purchaseOrders } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";

const receiptSchema = z.object({
  status: z.enum(["ordered", "received", "cancelled"]),
  receipts: z.array(z.object({ productId: z.string().uuid(), lotCode: z.string().trim().min(1).max(100), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() })).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const { id } = await context.params;
    const input = await readJson(request, receiptSchema);
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).for("update").limit(1);
      if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "No se encontró la orden.");
      const allowed = order.status === "pending" && ["ordered", "cancelled"].includes(input.status) || order.status === "ordered" && ["received", "cancelled"].includes(input.status);
      if (!allowed) throw new ApiError(409, "INVALID_ORDER_TRANSITION", `No se puede cambiar la orden de ${order.status} a ${input.status}.`);
      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
      if (input.status === "received") {
        if (!input.receipts || input.receipts.length !== items.length || new Set(input.receipts.map((receipt) => receipt.productId)).size !== items.length) {
          throw new ApiError(400, "RECEIPT_LOTS_REQUIRED", "Captura un lote por cada producto recibido antes de confirmar la entrada.");
        }
        const receiptByProduct = new Map(input.receipts.map((receipt) => [receipt.productId, receipt]));
        for (const item of items) {
          const receipt = receiptByProduct.get(item.productId);
          if (!receipt) throw new ApiError(400, "RECEIPT_LOT_MISSING", "Falta el lote de uno de los productos.");
          const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).for("update").limit(1);
          if (!product) throw new ApiError(409, "PRODUCT_MISSING", "La orden contiene un producto eliminado.");
          const quantity = Number(item.quantity) - Number(item.receivedQuantity);
          if (quantity <= 0) throw new ApiError(409, "ORDER_ALREADY_RECEIVED", "La orden ya tiene entradas registradas.");
          const [duplicate] = await tx.select({ id: inventoryLots.id }).from(inventoryLots).where(and(eq(inventoryLots.productId, product.id), eq(inventoryLots.lotCode, receipt.lotCode))).limit(1);
          if (duplicate) throw new ApiError(409, "DUPLICATE_LOT", `El lote ${receipt.lotCode} ya existe para ${product.name}.`);
          const oldStock = Number(product.stock);
          const newStock = oldStock + quantity;
          await tx.update(products).set({ stock: newStock.toFixed(3), updatedAt: new Date() }).where(eq(products.id, product.id));
          await tx.update(purchaseOrderItems).set({ receivedQuantity: Number(item.quantity).toFixed(3) }).where(eq(purchaseOrderItems.id, item.id));
          await tx.insert(inventoryLots).values({ productId: product.id, lotCode: receipt.lotCode, receivedQuantity: quantity.toFixed(3), remainingQuantity: quantity.toFixed(3), expiresAt: receipt.expiresOn || null, unitCost: item.unitCost, source: "purchase", receivedBy: user.id });
          await tx.insert(inventoryMovements).values({ productId: product.id, type: "in", quantity: quantity.toFixed(3), previousStock: oldStock.toFixed(3), newStock: newStock.toFixed(3), reason: `Recepción de orden ${order.orderNumber}, lote ${receipt.lotCode}`, userId: user.id });
        }
      }
      const [updated] = await tx.update(purchaseOrders).set({ status: input.status, receivedAt: input.status === "received" ? new Date() : order.receivedAt }).where(eq(purchaseOrders.id, id)).returning();
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: `purchase_order.${input.status}`, entityType: "purchase_order", entityId: id, summary: `Orden ${order.orderNumber} actualizada a ${input.status}${input.status === "received" ? "; existencias y lotes recibidos." : "."}`, metadata: { total: Number(order.total), lineCount: items.length } });
      return { id: updated.id, status: updated.status, receivedAt: updated.receivedAt };
    });
    return Response.json({ order: result });
  } catch (error) { return jsonError(error); }
}
