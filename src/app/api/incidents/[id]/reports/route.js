import { z } from "zod";
import { apiHandler, ok } from "@/lib/api";
import { ApiError, requireUser } from "@/lib/auth";
import { submitReport } from "@/lib/incidents";
import { INVESTIGATION_CAUSES } from "@/lib/validation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  findings: z.string().min(20, "Findings must be at least 20 characters").max(4000),
  causeClassification: z.string().min(1).max(160),
  areaBurnedHa: z.coerce.number().min(0).max(100000).optional().nullable(),
  cropAffected: z.string().max(120).optional().nullable(),
  evidenceUrls: z.array(z.string().url()).max(10).optional().default([]),
  recommendation: z.string().max(2000).optional().nullable(),
});

export async function POST(request, context) {
  return apiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const incidentId = Number(id);
    if (!Number.isFinite(incidentId)) throw new ApiError(400, "Invalid incident id");
    const body = bodySchema.parse(await request.json());
    if (!INVESTIGATION_CAUSES.includes(body.causeClassification)) {
      throw new ApiError(400, "Select a valid cause classification from the approved list");
    }
    const report = await submitReport({ user, incidentId, ...body });
    return ok({ report }, { status: 201 });
  });
}
