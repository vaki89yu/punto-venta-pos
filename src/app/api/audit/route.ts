import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents } from "@/db/schema";
import { jsonError } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireRole("admin", "manager");
    const rows = await getDb().select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(500);
    return Response.json({ events: rows.map((event) => ({
      id: event.id,
      actorId: event.actorId || "system",
      actorName: event.actorName,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId || undefined,
      summary: event.summary,
      metadata: event.metadata || undefined,
      occurredAt: event.createdAt.toISOString(),
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
