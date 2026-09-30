import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, suppliers } from "@/db/schema";
import { assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await getDb().select().from(suppliers).orderBy(asc(suppliers.name)).limit(3000);
    return Response.json({ suppliers: rows.map((row) => ({ ...row, balance: Number(row.balance) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(255),
  company: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const input = await readJson(request, supplierSchema);
    const db = getDb();
    const [supplier] = await db.insert(suppliers).values({ name: input.name, company: input.company, phone: input.phone || null, email: input.email || null, address: input.address || null, isActive: true }).returning();
    await db.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "supplier.created", entityType: "supplier", entityId: supplier.id, summary: `Proveedor creado: ${supplier.name}.` });
    return Response.json({ supplier: { ...supplier, balance: Number(supplier.balance) } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const body = await request.json() as { id?: string; isActive?: boolean };
    const id = z.string().uuid().parse(body.id);
    const isActive = z.boolean().parse(body.isActive);
    const [supplier] = await getDb().update(suppliers).set({ isActive }).where(eq(suppliers.id, id)).returning();
    if (!supplier) return Response.json({ error: { code: "SUPPLIER_NOT_FOUND", message: "No se encontró el proveedor." } }, { status: 404 });
    await getDb().insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: isActive ? "supplier.activated" : "supplier.deactivated", entityType: "supplier", entityId: id, summary: `Proveedor ${supplier.name} ${isActive ? "activado" : "desactivado"}.` });
    return Response.json({ supplier: { ...supplier, balance: Number(supplier.balance) } });
  } catch (error) { return jsonError(error); }
}
