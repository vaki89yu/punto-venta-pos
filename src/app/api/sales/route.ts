import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, cashRegisters, categories, customers, inventoryLots, inventoryMovements, products, saleItems, sales, storeSettings } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { mapProduct } from "@/lib/server/mappers";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const paymentDetailSchema = z.object({
  method: z.enum(["cash", "card", "transfer"]),
  amount: z.number().finite().positive(),
  reference: z.string().trim().max(255).optional(),
});
const saleSchema = z.object({
  ticketNumber: z.string().trim().min(3).max(50),
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().finite().positive().max(100_000), discountPercent: z.number().finite().min(0).max(100).default(0) })).min(1).max(250),
  paymentMethod: z.enum(["cash", "card", "transfer", "mixed"]),
  paymentDetails: z.array(paymentDetailSchema).min(1).max(10),
  cashReceived: z.number().finite().min(0).optional(),
  notes: z.string().max(1000).optional(),
});
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundQty = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export async function GET() {
  try {
    await requireUser();
    const db = getDb();
    const rows = await db.select({ sale: sales, item: saleItems, product: products, category: categories, customer: customers })
      .from(sales)
      .leftJoin(saleItems, eq(sales.id, saleItems.saleId))
      .leftJoin(products, eq(saleItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .orderBy(desc(sales.createdAt))
      .limit(5000);
    const grouped = new Map<string, { sale: typeof rows[number]["sale"]; customer: typeof rows[number]["customer"]; items: unknown[] }>();
    for (const row of rows) {
      let current = grouped.get(row.sale.id);
      if (!current) {
        current = { sale: row.sale, customer: row.customer, items: [] };
        grouped.set(row.sale.id, current);
      }
      if (row.item) {
        current.items.push({
          id: row.item.id,
          saleId: row.item.saleId,
          productId: row.item.productId,
          product: row.product ? mapProduct(row.product, row.category) : undefined,
          quantity: Number(row.item.quantity),
          price: Number(row.item.price),
          discount: Number(row.item.discount),
          tax: Number(row.item.tax),
          subtotal: Number(row.item.subtotal),
          total: Number(row.item.total),
          lotAllocations: row.item.lotAllocations || [],
        });
      }
    }
    const result = [...grouped.values()].map(({ sale, customer, items }) => ({
      ...sale,
      subtotal: Number(sale.subtotal), discount: Number(sale.discount), tax: Number(sale.tax), total: Number(sale.total),
      cashReceived: sale.cashReceived == null ? undefined : Number(sale.cashReceived),
      change: sale.change == null ? undefined : Number(sale.change),
      paymentDetails: sale.paymentDetails || [],
      customer: customer ? { ...customer, totalSpent: Number(customer.totalSpent), createdAt: customer.createdAt, lastPurchase: customer.lastPurchase || undefined } : undefined,
      items,
    }));
    return Response.json({ sales: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "cashier");
    const input = await readJson(request, saleSchema);
    const db = getDb();
    const saved = await db.transaction(async (tx) => {
      const existingTicket = await tx.select({ id: sales.id }).from(sales).where(eq(sales.ticketNumber, input.ticketNumber)).limit(1);
      if (existingTicket.length) throw new ApiError(409, "DUPLICATE_TICKET", "Este número de ticket ya fue procesado. Actualiza las ventas antes de reintentar.");

      const productIds = [...new Set(input.items.map((item) => item.productId))];
      const lockedProducts = await tx.select().from(products).where(inArray(products.id, productIds)).for("update");
      const productById = new Map(lockedProducts.map((product) => [product.id, product]));
      if (productById.size !== productIds.length) throw new ApiError(409, "PRODUCT_CHANGED", "Uno o más productos ya no están disponibles.");
      if (input.customerId) {
        const [customer] = await tx.select({ id: customers.id, isActive: customers.isActive }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
        if (!customer?.isActive) throw new ApiError(400, "CUSTOMER_INVALID", "El cliente seleccionado no está activo.");
      }
      if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
        throw new ApiError(400, "DUPLICATE_SALE_LINES", "El carrito contiene partidas duplicadas; actualízalo e inténtalo de nuevo.");
      }
      const [settings] = await tx.select({ minimumGrossMarginPercent: storeSettings.minimumGrossMarginPercent }).from(storeSettings).limit(1);
      const minimumMargin = settings ? Number(settings.minimumGrossMarginPercent) : 10;

      const mergedQuantities = new Map(input.items.map((item) => [item.productId, item.quantity]));
      const lotsByProduct = new Map<string, (typeof inventoryLots.$inferSelect)[]>();
      for (const productId of productIds) {
        const lots = await tx.select().from(inventoryLots).where(eq(inventoryLots.productId, productId)).orderBy(asc(inventoryLots.expiresAt), asc(inventoryLots.receivedAt)).for("update");
        lotsByProduct.set(productId, lots);
      }

      const calculated = [] as { productId: string; quantity: number; price: number; discountAmount: number; taxAmount: number; subtotal: number; total: number; allocations: { lotId: string; lotCode: string; quantity: number }[] }[];
      for (const item of input.items) {
        const product = productById.get(item.productId)!;
        if (!product.isActive) throw new ApiError(409, "PRODUCT_INACTIVE", `${product.name} ya no está activo.`);
        const price = Number(product.salePrice);
        const cost = Number(product.purchasePrice);
        const requestedMargin = ((price * (1 - item.discountPercent / 100) - cost) / Math.max(price * (1 - item.discountPercent / 100), 0.0001)) * 100;
        if (item.discountPercent > 0 && requestedMargin + 0.001 < minimumMargin) {
          throw new ApiError(403, "MARGIN_FLOOR", `El descuento de ${product.name} deja el margen por debajo del mínimo de ${minimumMargin}%.`);
        }
        const productLots = lotsByProduct.get(product.id) || [];
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const tracked = productLots.reduce((sum, lot) => sum + Math.max(0, Number(lot.remainingQuantity)), 0);
        const untracked = Math.max(0, Number(product.stock) - tracked);
        const eligible = productLots.filter((lot) => Number(lot.remainingQuantity) > 0 && (!lot.expiresAt || String(lot.expiresAt) >= today));
        const sellableLots = eligible.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0);
        const available = roundQty(Math.min(Number(product.stock), untracked + sellableLots));
        const quantityForProduct = mergedQuantities.get(product.id) || 0;
        if (quantityForProduct > available + 0.0001) throw new ApiError(409, "INSUFFICIENT_STOCK", `Stock insuficiente de ${product.name}. Disponible: ${available} ${product.unit}.`);

        let remainingTracked = Math.min(item.quantity, sellableLots);
        const allocations: { lotId: string; lotCode: string; quantity: number }[] = [];
        for (const lot of eligible) {
          if (remainingTracked <= 0.0001) break;
          const currentQty = Number(lot.remainingQuantity);
          const take = roundQty(Math.min(currentQty, remainingTracked));
          if (!take) continue;
          await tx.update(inventoryLots).set({ remainingQuantity: roundQty(currentQty - take).toFixed(3) }).where(eq(inventoryLots.id, lot.id));
          allocations.push({ lotId: lot.id, lotCode: lot.lotCode, quantity: take });
          remainingTracked = roundQty(remainingTracked - take);
        }
        const lineSubtotal = roundMoney(price * item.quantity);
        const discountAmount = roundMoney(lineSubtotal * item.discountPercent / 100);
        const taxable = roundMoney(lineSubtotal - discountAmount);
        const taxAmount = roundMoney(taxable * Math.max(0, Number(product.tax)) / 100);
        calculated.push({ productId: product.id, quantity: item.quantity, price, discountAmount, taxAmount, subtotal: lineSubtotal, total: roundMoney(taxable + taxAmount), allocations });
      }

      const subtotal = roundMoney(calculated.reduce((sum, item) => sum + item.subtotal - item.discountAmount, 0));
      const discount = roundMoney(calculated.reduce((sum, item) => sum + item.discountAmount, 0));
      const tax = roundMoney(calculated.reduce((sum, item) => sum + item.taxAmount, 0));
      const total = roundMoney(calculated.reduce((sum, item) => sum + item.total, 0));
      const paymentsTotal = roundMoney(input.paymentDetails.reduce((sum, payment) => sum + payment.amount, 0));
      if (Math.abs(paymentsTotal - total) > 0.01) throw new ApiError(400, "PAYMENT_MISMATCH", "La suma de los métodos de pago debe coincidir con el total de la venta.");
      if (input.paymentMethod === "mixed" && input.paymentDetails.length < 2) throw new ApiError(400, "SPLIT_PAYMENT_INVALID", "Una venta dividida requiere al menos dos formas de pago.");
      if (input.paymentMethod !== "mixed" && (input.paymentDetails.length !== 1 || input.paymentDetails[0].method !== input.paymentMethod)) throw new ApiError(400, "PAYMENT_METHOD_MISMATCH", "Revisa el método de pago seleccionado.");
      const cashPaid = roundMoney(input.paymentDetails.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amount, 0));
      const cardPaid = roundMoney(input.paymentDetails.filter((payment) => payment.method === "card").reduce((sum, payment) => sum + payment.amount, 0));
      const transferPaid = roundMoney(input.paymentDetails.filter((payment) => payment.method === "transfer").reduce((sum, payment) => sum + payment.amount, 0));
      if (cashPaid > 0 && (input.cashReceived == null || input.cashReceived + 0.001 < cashPaid)) throw new ApiError(400, "CASH_RECEIVED_INVALID", "El efectivo recibido es menor al importe pagado en efectivo.");
      const change = input.cashReceived == null ? 0 : roundMoney(Math.max(0, input.cashReceived - cashPaid));

      const [sale] = await tx.insert(sales).values({
        ticketNumber: input.ticketNumber,
        customerId: input.customerId || null,
        userId: user.id,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: input.paymentMethod,
        paymentDetails: input.paymentDetails,
        cashReceived: input.cashReceived == null ? null : input.cashReceived.toFixed(2),
        change: change.toFixed(2),
        status: "completed",
        notes: input.notes || null,
      }).returning();

      const persistedItems = [];
      for (const item of calculated) {
        const [savedItem] = await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity.toFixed(3),
          price: item.price.toFixed(2),
          discount: item.discountAmount.toFixed(2),
          tax: item.taxAmount.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
          total: item.total.toFixed(2),
          lotAllocations: item.allocations,
        }).returning();
        persistedItems.push({ id: savedItem.id, saleId: sale.id, productId: item.productId, quantity: item.quantity, price: item.price, discount: item.discountAmount, tax: item.taxAmount, subtotal: item.subtotal, total: item.total, lotAllocations: item.allocations });
        const product = productById.get(item.productId)!;
        const oldStock = Number(product.stock);
        const newStock = roundQty(oldStock - item.quantity);
        await tx.update(products).set({ stock: newStock.toFixed(3), updatedAt: new Date() }).where(eq(products.id, product.id));
        await tx.insert(inventoryMovements).values({ productId: product.id, type: "sale", quantity: item.quantity.toFixed(3), previousStock: oldStock.toFixed(3), newStock: newStock.toFixed(3), reason: `Venta ${input.ticketNumber}`, saleId: sale.id, userId: user.id });
      }

      if (input.customerId) {
        await tx.update(customers).set({
          totalSpent: sql`${customers.totalSpent} + ${total.toFixed(2)}`,
          totalPurchases: sql`${customers.totalPurchases} + 1`,
          lastPurchase: new Date(),
        }).where(eq(customers.id, input.customerId));
      }
      const [register] = await tx.select().from(cashRegisters).where(and(eq(cashRegisters.userId, user.id), eq(cashRegisters.status, "open"))).for("update").limit(1);
      if (!register) throw new ApiError(409, "CASH_REGISTER_CLOSED", "Abre tu caja antes de registrar una venta.");
      await tx.update(cashRegisters).set({ cashSales: sql`${cashRegisters.cashSales} + ${cashPaid.toFixed(2)}`, cardSales: sql`${cashRegisters.cardSales} + ${cardPaid.toFixed(2)}`, transferSales: sql`${cashRegisters.transferSales} + ${transferPaid.toFixed(2)}` }).where(eq(cashRegisters.id, register.id));
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "sale.completed", entityType: "sale", entityId: sale.id, summary: `Venta ${sale.ticketNumber} completada por $${total.toFixed(2)}.`, metadata: { total, paymentMethod: input.paymentMethod, lineCount: calculated.length } });
      return { id: sale.id, ticketNumber: sale.ticketNumber, subtotal, discount, tax, total, paymentMethod: sale.paymentMethod, paymentDetails: sale.paymentDetails, cashReceived: input.cashReceived, change, status: sale.status, createdAt: sale.createdAt, updatedAt: sale.updatedAt, customerId: input.customerId || undefined, userId: user.id, items: persistedItems };
    });
    return Response.json({ sale: saved }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
