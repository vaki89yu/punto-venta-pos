import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, cashMovements, cashRegisters } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const money = z.number().finite().min(0).max(999_999_999.99);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), openingAmount: money }),
  z.object({ action: z.literal("close"), registerId: z.string().uuid(), closingAmount: money }),
  z.object({ action: z.literal("movement"), registerId: z.string().uuid(), type: z.enum(["in", "out"]), amount: z.number().finite().positive().max(999_999_999.99), reason: z.string().trim().min(3).max(500) }),
]);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const publicRegister = (register: typeof cashRegisters.$inferSelect, userName: string) => {
  const expectedAmount = roundMoney(Number(register.openingAmount) + Number(register.cashSales) + Number(register.cashIn) - Number(register.cashOut));
  return { id: register.id, userId: register.userId, userName, openingAmount: Number(register.openingAmount), closingAmount: register.closingAmount === null ? undefined : Number(register.closingAmount), cashSales: Number(register.cashSales), cardSales: Number(register.cardSales), transferSales: Number(register.transferSales), cashIn: Number(register.cashIn), cashOut: Number(register.cashOut), expectedAmount, difference: register.difference === null ? undefined : Number(register.difference), openedAt: register.openedAt.toISOString(), closedAt: register.closedAt?.toISOString(), status: register.status };
};

export async function GET() {
  try {
    const user = await requireUser();
    const db = getDb();
    const [register] = await db.select().from(cashRegisters).where(eq(cashRegisters.userId, user.id)).orderBy(desc(cashRegisters.openedAt)).limit(1);
    if (!register) return Response.json({ cashRegister: null, movements: [] }, { headers: { "Cache-Control": "no-store" } });
    const movements = await db.select().from(cashMovements).where(eq(cashMovements.cashRegisterId, register.id)).orderBy(desc(cashMovements.createdAt)).limit(250);
    return Response.json({ cashRegister: publicRegister(register, user.name), movements: movements.map((movement) => ({ id: movement.id, type: movement.type, amount: Number(movement.amount), reason: movement.reason, userId: movement.userId, createdAt: movement.createdAt.toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, actionSchema);
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      if (input.action === "open") {
        const [openRegister] = await tx.select().from(cashRegisters).where(and(eq(cashRegisters.userId, user.id), eq(cashRegisters.status, "open"))).for("update").limit(1);
        if (openRegister) throw new ApiError(409, "REGISTER_ALREADY_OPEN", "Ya tienes una caja abierta.");
        const amount = roundMoney(input.openingAmount);
        const [created] = await tx.insert(cashRegisters).values({ userId: user.id, openingAmount: amount.toFixed(2), expectedAmount: amount.toFixed(2), status: "open" }).returning();
        await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "cash_register.opened", entityType: "cash_register", entityId: created.id, summary: `Caja abierta por $${amount.toFixed(2)}.`, metadata: { openingAmount: amount } });
        return { cashRegister: publicRegister(created, user.name), difference: undefined };
      }

      const [register] = await tx.select().from(cashRegisters).where(and(eq(cashRegisters.id, input.registerId), eq(cashRegisters.userId, user.id), eq(cashRegisters.status, "open"))).for("update").limit(1);
      if (!register) throw new ApiError(404, "OPEN_REGISTER_NOT_FOUND", "No hay una caja abierta que coincida con esta sesión.");
      if (input.action === "close") {
        const expected = roundMoney(Number(register.openingAmount) + Number(register.cashSales) + Number(register.cashIn) - Number(register.cashOut));
        const counted = roundMoney(input.closingAmount);
        const difference = roundMoney(counted - expected);
        const [closed] = await tx.update(cashRegisters).set({ closingAmount: counted.toFixed(2), expectedAmount: expected.toFixed(2), difference: difference.toFixed(2), status: "closed", closedAt: new Date() }).where(eq(cashRegisters.id, register.id)).returning();
        await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "cash_register.closed", entityType: "cash_register", entityId: register.id, summary: `Caja cerrada. Diferencia: $${difference.toFixed(2)}.`, metadata: { expected, counted, difference } });
        return { cashRegister: publicRegister(closed, user.name), difference };
      }

      const amount = roundMoney(input.amount);
      const availableCash = roundMoney(Number(register.openingAmount) + Number(register.cashSales) + Number(register.cashIn) - Number(register.cashOut));
      if (input.type === "out" && amount > availableCash) throw new ApiError(409, "INSUFFICIENT_REGISTER_CASH", "La salida supera el efectivo esperado en caja.");
      const cashIn = Number(register.cashIn) + (input.type === "in" ? amount : 0);
      const cashOut = Number(register.cashOut) + (input.type === "out" ? amount : 0);
      const [updated] = await tx.update(cashRegisters).set({ cashIn: cashIn.toFixed(2), cashOut: cashOut.toFixed(2) }).where(eq(cashRegisters.id, register.id)).returning();
      const [movement] = await tx.insert(cashMovements).values({ cashRegisterId: register.id, type: input.type, amount: amount.toFixed(2), reason: input.reason, userId: user.id }).returning();
      await tx.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: `cash.${input.type}`, entityType: "cash_register", entityId: register.id, summary: `${input.type === "in" ? "Entrada" : "Salida"} de efectivo por $${amount.toFixed(2)}. Motivo: ${input.reason}.`, metadata: { amount, type: input.type, reason: input.reason } });
      return { cashRegister: publicRegister(updated, user.name), difference: undefined, movement: { id: movement.id, type: movement.type, amount: Number(movement.amount), reason: movement.reason, userId: movement.userId, createdAt: movement.createdAt.toISOString() } };
    });
    return Response.json(result, { status: input.action === "open" ? 201 : 200 });
  } catch (error) { return jsonError(error); }
}
