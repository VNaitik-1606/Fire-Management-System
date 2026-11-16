import { db } from "@/db";
import { getFirmsApiKey } from "@/lib/env";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      service: "firewatch-api",
      database: "connected",
      firmsConfigured: Boolean(getFirmsApiKey()),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, database: "unavailable" }, { status: 500 });
  }
}
