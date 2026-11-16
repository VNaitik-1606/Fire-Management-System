import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runIngestion } from "@/lib/ingest";
import { ensureSeeded } from "@/lib/seed";

const bodySchema = z.object({
  source: z.string().default("VIIRS_NOAA20_NRT"),
  dayRange: z.coerce.number().int().min(1).max(10).default(2),
  mode: z.enum(["live", "simulate"]).default("live"),
});

/**
 * Cron / scheduler entry point. Node-Cron, a platform scheduler or an external
 * worker calls this endpoint with a bearer secret. No user session is required,
 * but the shared secret is mandatory and the run is attributed to the state
 * administrator account for auditability.
 */
export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured on the server" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.replace(/^Bearer\s+/i, "") || request.headers.get("x-cron-secret") || "";
  if (provided !== secret) {
    return Response.json({ error: "Invalid scheduler credentials" }, { status: 401 });
  }

  await ensureSeeded();
  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) return Response.json({ error: "No administrator account available" }, { status: 500 });

  const body = bodySchema.parse(await request.json().catch(() => ({})));
  const systemUser = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: "admin",
    designation: admin.designation,
    districtId: admin.districtId,
    districtName: null,
    districtCode: null,
    state: null,
  };
  const result = await runIngestion({ user: systemUser, source: body.source, dayRange: body.dayRange, mode: body.mode });
  return Response.json({ result }, { status: result.status === "success" ? 200 : 502 });
}
