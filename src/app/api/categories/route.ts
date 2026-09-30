import { asc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, categories } from "@/db/schema";
import { assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { requireRole, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await getDb().select().from(categories).orderBy(asc(categories.name));
    return Response.json({ categories: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

const categorySchema = z.object({ name: z.string().trim().min(1).max(255), description: z.string().max(1000).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#2563EB"), icon: z.string().max(50).optional() });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("admin", "manager", "inventory");
    const input = await readJson(request, categorySchema);
    const db = getDb();
    const [category] = await db.insert(categories).values(input).returning();
    await db.insert(auditEvents).values({ actorId: user.id, actorName: user.name, action: "category.created", entityType: "category", entityId: category.id, summary: `Categoría creada: ${category.name}.` });
    return Response.json({ category }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
