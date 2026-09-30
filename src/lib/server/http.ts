import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { throw new ApiError(403, "CROSS_ORIGIN", "Solicitud no permitida."); }
  if (!host || originHost.toLowerCase() !== host.toLowerCase()) {
    throw new ApiError(403, "CROSS_ORIGIN", "Solicitud no permitida.");
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message || "Revisa los datos enviados.",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Error interno del servidor.";
  if (message.includes("DATABASE_URL no está configurada")) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED", message: "El sistema requiere una base de datos PostgreSQL. Configura DATABASE_URL y ejecuta la inicialización." } }, { status: 503 });
  }
  if (/relation .* does not exist|connect|timeout|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "No se pudo acceder a la base de datos. Verifica la conexión y que el esquema esté inicializado." } }, { status: 503 });
  }
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "No se pudo completar la operación." } }, { status: 500 });
}

export async function readJson<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError(400, "INVALID_JSON", "El cuerpo de la solicitud no es JSON válido."); }
  return schema.parse(body);
}
