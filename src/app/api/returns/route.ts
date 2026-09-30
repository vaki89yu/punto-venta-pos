import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, cashMovements, cashRegisters, inventoryLots, inventoryMovements, products, returnItems, returns, saleItems, sales } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const roundQty = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function GET() {
  try {
    await requireUser();
    const db = getDb();
    const rows = await db.select({ record: returns, sale: sales, item: returnItems, product: products })
      .from(returns).innerJoin(sales, eq(returns.saleId, sales.id))
      .leftJoin(returnItems, eq(returns.id, returnItems.returnId))
      .leftJoin(products, eq(returnItems.productId, products.id))
      .orderBy(desc(returns.createdAt)).limit(5000);
    const grouped = new Map<string, { record: typeof rows[number]["record"]; sale: typeof rows[number]["sale"]; items: object[] }>();
    for (const row of rows) {
      let group = grouped.get(row.record.id);
      if (!group) { group = { record: row.record, sale: row.sale, items: [] }; grouped.set(row.record.id, group); }
      if (row.item) group.items.push({ id: row.item.id, returnId: row.item.returnId, saleItemId: row.item.saleItemId, productId: row.item.productId, productName: row.product?.name || "Producto retirado", quantityReturned: Number(row.item.quantity), price: Number(row.item.price), refundAmount: Number(row.item.refundAmount), lotAllocations: row.item.lotAllocations || [] });
    }
    return Response.json({ returns: [...grouped.values()].map(({ record, sale, items }) => ({ id: record.id, saleId: record.saleId, ticketNumber: sale.ticketNumber, items, totalRefund: Number(record.totalRefund), reason: record.reason, refundMethod: record.refundMethod, status: record.status, processedBy: record.processedBy || "", processedAt: record.processedAt?.toISOString(), createdAt: record.createdAt.toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const returnSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
  refundMethod: z.enum(["cash", "card", "transfer"]),
  items: z.array(z.object({ saleItemId: z.string().uuid(), quantityReturned: z.number().finite().positive().max(100_000) })).min(1).max(250),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager");
    const input = await readJson(request, returnSchema);
    if (new Set(input.items.map((item) => item.saleItemId)).size !== input.items.length) throw new ApiError(400, "DUPLICATE_RETURN_LINES", "Combina partidas repetidas de la devolución.");
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, input.saleId)).for("update").limit(1);
      if (!sale || !["completed", "refunded"].includes(sale.status)) throw new ApiError(404, "SALE_NOT_RETURNABLE", "No se encontró una venta que pueda devolverse.");
      const saleLines = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      const saleLineMap = new Map(saleLines.map((item) => [item.id, item]));
      const priorRecords = await tx.select({ id: returns.id }).from(returns).where(eq(returns.saleId, sale.id));
      const allPriorReturnItems = priorRecords.length ? await tx.select().from(returnItems).where(inArray(returnItems.returnId, priorRecords.map((record) => record.id))) : [];
      const alreadyReturned = new Map<string, number>();
      for (const item of allPriorReturnItems) alreadyReturned.set(item.saleItemId, (alreadyReturned.get(item.saleItemId) || 0) + Number(item.quantity));
      const planned = [] as { saleItem: typeof saleItems.$inferSelect; productName: string; quantity: number; refund: number; lots: { lotId: string; lotCode: string; quantity: number }[] }[];
      for (const requested of input.items) {
        const original = saleLineMap.get(requested.saleItemId);
        if (!original) throw new ApiError(400, "SALE_LINE_INVALID", "Una partida no pertenece a este ticket.");
        const remaining = Number(original.quantity) - (alreadyReturned.get(original.id) || 0);
        if (requested.quantityReturned > remaining + 0.0001) throw new ApiError(409, "RETURN_QUANTITY_EXCEEDED", `La cantidad a devolver supera lo disponible en la partida ${original.id.slice(0, 8)}.`);
        const refund = roundMoney(Number(original.total) * requested.quantityReturned / Number(original.quantity));
        const alreadyByLot = new Map<string, number>();
        for (const prior of allPriorReturnItems.filter((item) => item.saleItemId === original.id)) {
          for (const allocation of prior.lotAllocations || []) alreadyByLot.set(allocation.lotId, (alreadyByLot.get(allocation.lotId) || 0) + Number(allocation.quantity));
        }
        let remainingTracked = requested.quantityReturned;
        const allocations: { lotId: string; lotCode: string; quantity: number }[] = [];
        for (const allocation of original.lotAllocations || []) {
          if (remainingTracked <= 0.0001) break;
          const available = Math.max(0, Number(allocation.quantity) - (alreadyByLot.get(allocation.lotId) || 0));
          const restore = roundQty(Math.min(available, remainingTracked));
          if (restore <= 0) continue;
          const [lot] = await tx.select().from(inventoryLots).where(eq(inventoryLots.id, allocation.lotId)).for("update").limit(1);
          if (!lot) throw new ApiError(409, "LOT_MISSING", "No se encontró un lote original para restituir.");
          await tx.update(inventoryLots).set({ remainingQuantity: (Number(lot.remainingQuantity) + restore).toFixed(3) }).where(eq(inventoryLots.id, lot.id));
          allocations.push({ lotId: lot.id, lotCode: allocation.lotCode, quantity: restore });
          remainingTracked = roundQty(remainingTracked - restore);
        }
        const [product] = await tx.select().from(products).where(eq(products.id, original.productId)).for("update").limit(1);
        if (!product) throw new ApiError(409, "PRODUCT_MISSING", "No se puede reingresar un producto eliminado.");
        const previousStock = Number(product.stock);
        const newStock = roundQty(previousStock + requested.quantityReturned);
        await tx.update(products).set({ stock: newStock.toFixed(3), updatedAt: new Date() }).where(eq(products.id, product.id));
        await tx.insert(inventoryMovements).values({ productId: product.id, type: "return", quantity: requested.quantityReturned.toFixed(3), previousStock: previousStock.toFixed(3), newStock: newStock.toFixed(3), reason: `Devolución de ticket ${sale.ticketNumber}`, saleId: sale.id, userId: user.id });
        planned.push({ saleItem: original, productName: product.name, quantity: requested.quantityReturned, refund, lots: allocations });
      }

      const totalRefund = roundMoney(planned.reduce((sum, item) => sum + item.refund, 0));
      const [returnRecord] = await tx.insert(returns).values({ saleId: sale.id, totalRefund: totalRefund.toFixed(2), reason: input.reason, refundMethod: input.refundMethod, status: "approved", processedBy: user.id, processedAt: new Date() }).returning();
      const savedItems = [];
      for (const item of planned) {
        const [saved] = await tx.insert(returnItems).values({ returnId: returnRecord.id, saleItemId: item.saleItem.id, productId: item.saleItem.productId, quantity: item.quantity.toFixed(3), price: String(item.saleItem.price), refundAmount: item.refund.toFixed(2), lotAllocations: item.lots }).returning();
        savedItems.push({ id: saved.id, saleItemId: saved.saleItemId, productId: saved.productId, productName: item.productName, quantityReturned: Number(saved.quantity), price: Number(saved.price), refundAmount: Number(saved.refundAmount), lotAllocations: item.lots });
      }

      if (input.refundMethod === "cash") {
        const [register] = await tx.select().from(cashRegisters).where(and(eq(cashRegisters.userId, user.id), eq(cashRegisters.status, "open"))).for("update").limit(1);
        if (!register) throw new ApiError(409, "CASH_REGISTER_CLOSED", "Abre la caja antes de entregar un reembolso en efectivo.");
        const availableCash = roundMoney(Number(register.openingAmount) + Number(register.cashSales) + Number(register.cashIn) - Number(register.cashOut));
        if (totalRefund > availableCash) throw new ApiError(409, "INSUFFICIENT_REGISTER_CASH", "El efectivo disponible en caja no alcanza para este reembolso.");
        const previousCashOut = Number(register.cashOut);
        await tx.update(cashRegisters).set({ cashOut: (previousCashOut + totalRefund).toFixed(2) }).where(eq(cashRegisters.id, register.id));
        await tx.insert(cashMovements).values({ cashRegisterId: register.id, type: "out", amount: totalRefund.toFixed(2), reason: `Reembolso de ticket ${sale.ticketNumber}`, userId: user.id });
      }

      const totals = new Map(alreadyReturned);
      planned.forEach((item) => totals.set(item.saleItem.id, (totals.get(item.saleItem.id) || 0) + item.quantity));
      const fullyReturned = saleLines.every((item) => (totals.get(item.id) || 0) >= Number(item.quantity) - 0.0001);
      if (fullyReturned) await tx.update(sales).set({ status: "refunded", updatedAt: new Date() }).where(eq(sales.id, sale.id));
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "return.approved", entityType: "return", entityId: returnRecord.id, summary: `Devolución aprobada del ticket ${sale.ticketNumber} por $${totalRefund.toFixed(2)} mediante ${input.refundMethod}.`, metadata: { saleId: sale.id, totalRefund, method: input.refundMethod, lines: planned.length, fullyReturned } });
      return { id: returnRecord.id, saleId: sale.id, ticketNumber: sale.ticketNumber, items: savedItems, totalRefund, reason: input.reason, refundMethod: input.refundMethod, status: returnRecord.status, processedBy: user.id, createdAt: returnRecord.createdAt.toISOString() };
    });
    return Response.json({ returnRecord: result }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
