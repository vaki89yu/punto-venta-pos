import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, inventoryLots, inventoryMovements, products, purchaseOrderItems, purchaseOrders, suppliers } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const db = getDb();
    const rows = await db.select({ order: purchaseOrders, supplier: suppliers, item: purchaseOrderItems, product: products })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(purchaseOrderItems, eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId))
      .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
      .orderBy(desc(purchaseOrders.createdAt)).limit(5000);
    const groups = new Map<string, { order: typeof rows[number]["order"]; supplier: typeof rows[number]["supplier"]; items: object[] }>();
    for (const row of rows) {
      let group = groups.get(row.order.id);
      if (!group) { group = { order: row.order, supplier: row.supplier, items: [] }; groups.set(row.order.id, group); }
      if (row.item) group.items.push({ productId: row.item.productId, productName: row.product?.name || "Producto retirado", quantity: Number(row.item.quantity), receivedQuantity: Number(row.item.receivedQuantity), unitCost: Number(row.item.unitCost), total: Number(row.item.total) });
    }
    return Response.json({ orders: [...groups.values()].map(({ order, supplier, items }) => ({
      id: order.id, orderNumber: order.orderNumber, supplierId: order.supplierId, supplierName: supplier.name,
      items, total: Number(order.total), status: order.status, expectedDate: order.expectedDate ? new Date(`${order.expectedDate}T12:00:00Z`) : undefined,
      notes: order.notes || undefined, createdAt: order.createdAt, receivedAt: order.receivedAt || undefined,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const createSchema = z.object({
  supplierId: z.string().uuid(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().finite().positive().max(1_000_000), unitCost: z.number().finite().min(0) })).min(1).max(500),
  expectedDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  notes: z.string().max(2000).optional(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const input = await readJson(request, createSchema);
    if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) throw new ApiError(400, "DUPLICATE_ORDER_LINES", "Combina productos repetidos antes de guardar la orden.");
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
      if (!supplier?.isActive) throw new ApiError(404, "SUPPLIER_NOT_FOUND", "El proveedor no existe o está inactivo.");
      const productIds = input.items.map((item) => item.productId);
      const productRows = await tx.select().from(products).where(eq(products.isActive, true));
      const productMap = new Map(productRows.filter((product) => productIds.includes(product.id)).map((product) => [product.id, product]));
      if (productMap.size !== input.items.length) throw new ApiError(400, "PRODUCT_INVALID", "Una orden contiene productos inexistentes o inactivos.");
      const total = Math.round(input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) * 100) / 100;
      const orderNumber = `OC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const [order] = await tx.insert(purchaseOrders).values({
        orderNumber, supplierId: supplier.id, createdBy: user.id, status: "pending", total: total.toFixed(2),
        expectedDate: input.expectedDate ? input.expectedDate.slice(0, 10) : null, notes: input.notes || null,
      }).returning();
      await tx.insert(purchaseOrderItems).values(input.items.map((item) => ({
        purchaseOrderId: order.id, productId: item.productId, quantity: item.quantity.toFixed(3), receivedQuantity: "0",
        unitCost: item.unitCost.toFixed(2), total: (item.quantity * item.unitCost).toFixed(2),
      })));
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "purchase_order.created", entityType: "purchase_order", entityId: order.id, summary: `Orden ${orderNumber} creada para ${supplier.name}; pendiente de envío al proveedor.`, metadata: { total, lines: input.items.length } });
      return { id: order.id, orderNumber, supplierId: supplier.id, supplierName: supplier.name, items: input.items.map((item) => ({ ...item, productName: productMap.get(item.productId)!.name, receivedQuantity: 0, total: item.quantity * item.unitCost })), total, status: order.status, expectedDate: order.expectedDate, notes: order.notes || undefined, createdAt: order.createdAt };
    });
    return Response.json({ order: result }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
