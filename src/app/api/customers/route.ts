import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, customers } from "@/db/schema";
import { assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await getDb().select().from(customers).orderBy(asc(customers.name)).limit(5000);
    return Response.json({ customers: rows.map((row) => ({ ...row, totalSpent: Number(row.totalSpent) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const customerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional(),
  rfc: z.string().trim().max(13).optional(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "cashier");
    const input = await readJson(request, customerSchema);
    const db = getDb();
    const [customer] = await db.insert(customers).values({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      rfc: input.rfc?.toUpperCase() || null,
      isActive: true,
    }).returning();
    await db.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "customer.created", entityType: "customer", entityId: customer.id, summary: `Cliente creado: ${customer.name}.` });
    return Response.json({ customer: { ...customer, totalSpent: Number(customer.totalSpent) } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "cashier");
    const body = await request.json() as { id?: string; isActive?: boolean };
    const id = z.string().uuid().parse(body.id);
    const isActive = z.boolean().parse(body.isActive);
    const [customer] = await getDb().update(customers).set({ isActive }).where(eq(customers.id, id)).returning();
    if (!customer) return Response.json({ error: { code: "CUSTOMER_NOT_FOUND", message: "No se encontró el cliente." } }, { status: 404 });
    await getDb().insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: isActive ? "customer.activated" : "customer.deactivated", entityType: "customer", entityId: id, summary: `Cliente ${customer.name} ${isActive ? "activado" : "desactivado"}.` });
    return Response.json({ customer: { ...customer, totalSpent: Number(customer.totalSpent) } });
  } catch (error) { return jsonError(error); }
}
