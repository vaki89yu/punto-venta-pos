import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { publicUser, requireRole } from "@/lib/server/session";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(12).max(200).optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "cashier", "inventory"]).optional(),
  isActive: z.boolean().optional(),
}).strict();

async function protectLastAdmin(tx: ReturnType<typeof getDb>, target: typeof users.$inferSelect, patch: { role?: typeof target.role; isActive?: boolean }) {
  const removesAdmin = target.role === "admin" && target.isActive && (patch.role !== undefined && patch.role !== "admin" || patch.isActive === false);
  if (!removesAdmin) return;
  const [count] = await tx.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "admin"));
  const [activeCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(users).where(sql`${users.role} = 'admin' and ${users.isActive} = true`);
  if (Number(activeCount?.count ?? count?.count ?? 0) <= 1) throw new ApiError(409, "LAST_ADMIN", "No se puede desactivar o degradar al último administrador activo.");
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireRole("admin");
    const { id } = await context.params;
    const input = await readJson(request, updateSchema);
    const db = getDb();
    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) throw new ApiError(404, "USER_NOT_FOUND", "No se encontró el usuario.");
    await protectLastAdmin(db, before, input);
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined) patch.email = input.email;
    if (input.role !== undefined) patch.role = input.role;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.password) patch.password = await bcrypt.hash(input.password, 12);
    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    await db.insert(auditEvents).values({ actorId: actor.id, actorName: actor.name, action: "user.updated", entityType: "user", entityId: id, summary: `Usuario actualizado: ${updated.email}.`, metadata: { role: updated.role, active: updated.isActive, passwordChanged: Boolean(input.password) } });
    return Response.json({ user: publicUser(updated) });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "23505") return jsonError(new ApiError(409, "EMAIL_ALREADY_EXISTS", "Ya existe una cuenta con ese correo."));
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireRole("admin");
    const { id } = await context.params;
    if (actor.id === id) throw new ApiError(409, "SELF_DEACTIVATION", "No puedes desactivar tu propia cuenta.");
    const db = getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new ApiError(404, "USER_NOT_FOUND", "No se encontró el usuario.");
    await protectLastAdmin(db, target, { isActive: false });
    const [updated] = await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    await db.insert(auditEvents).values({ actorId: actor.id, actorName: actor.name, action: "user.deactivated", entityType: "user", entityId: id, summary: `Usuario desactivado: ${target.email}.` });
    return Response.json({ user: publicUser(updated) });
  } catch (error) { return jsonError(error); }
}
