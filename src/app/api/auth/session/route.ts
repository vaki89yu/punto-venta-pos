import { jsonError } from "@/lib/server/http";
import { getAuthenticatedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ user: await getAuthenticatedUser() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
