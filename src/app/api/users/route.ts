import bcrypt from "bcryptjs";
import { asc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { publicUser, requireRole } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const createSchema = z.object({ name: z.string().trim().min(2).max(255), email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()), password: z.string().min(12).max(200), role: z.enum(["admin", "manager", "cashier", "inventory"]) });

export async function GET() {
  try {
    await requireRole("admin");
    const rows = await getDb().select().from(users).orderBy(asc(users.name)).limit(1000);
    return Response.json({ users: rows.map(publicUser) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireRole("admin");
    const input = await readJson(request, createSchema);
    const db = getDb();
    const password = await bcrypt.hash(input.password, 12);
    const [created] = await db.insert(users).values({ name: input.name, email: input.email, password, role: input.role, isActive: true }).returning();
    await db.insert(auditEvents).values({ actorId: actor.id, actorName: actor.name, action: "user.created", entityType: "user", entityId: created.id, summary: `Usuario creado: ${created.email} (${created.role}).` });
    return Response.json({ user: publicUser(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "23505") return jsonError(new ApiError(409, "EMAIL_ALREADY_EXISTS", "Ya existe una cuenta con ese correo."));
    return jsonError(error);
  }
}
