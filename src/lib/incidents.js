import "server-only";
import { db } from "@/db";
import {
  districts,
  incidentEvents,
  incidents,
  investigationReports,
  observations,
  users,
} from "@/db/schema";
import { and, count, desc, eq, like } from "drizzle-orm";
import { ApiError, assertDistrictScope } from "@/lib/auth";
import { STATUS_TRANSITIONS } from "@/lib/constants";

async function nextReference(districtCode) {
  const year = new Date().getFullYear();
  const prefix = `${districtCode}-${year}-`;
  const [row] = await db
    .select({ n: count() })
    .from(incidents)
    .where(like(incidents.reference, `${prefix}%`));
  return `${prefix}${String(Number(row?.n ?? 0) + 1).padStart(3, "0")}`;
}

export async function createIncidentFromObservation(input) {
  const [observation] = await db.select().from(observations).where(eq(observations.id, input.observationId)).limit(1);
  if (!observation) throw new ApiError(404, "Observation not found");
  if (!observation.districtId) {
    throw new ApiError(
      422,
      "This detection lies outside every configured district boundary. Map the district before raising an incident.",
    );
  }
  assertDistrictScope(input.user, observation.districtId);

  const [existing] = await db
    .select({ id: incidents.id, reference: incidents.reference })
    .from(incidents)
    .where(eq(incidents.observationId, observation.id))
    .limit(1);
  if (existing) throw new ApiError(409, `Detection already linked to incident ${existing.reference}`);

  const [district] = await db.select().from(districts).where(eq(districts.id, observation.districtId)).limit(1);
  if (!district) throw new ApiError(422, "District reference missing");
  const reference = await nextReference(district.code);

  const severity =
    input.severity ??
    (observation.frp && observation.frp > 45
      ? "critical"
      : observation.frp && observation.frp > 25
        ? "high"
        : observation.frp && observation.frp > 12
          ? "medium"
          : "low");

  const [incident] = await db
    .insert(incidents)
    .values({
      reference,
      observationId: observation.id,
      districtId: district.id,
      latitude: observation.latitude,
      longitude: observation.longitude,
      status: "suspected",
      severity,
      landUse: input.landUse ?? "Agricultural",
      cropType: input.cropType ?? null,
      suspectedCause: input.suspectedCause ?? "Pending field verification",
      summary:
        input.summary ??
        `Satellite detection (${observation.satellite ?? observation.source}) at FRP ${observation.frp ?? "—"} MW, ${
          observation.confidencePct ?? "—"
        }% confidence. Linked to observation #${observation.id} and awaiting field verification.`,
      createdById: input.user.id,
      detectedAt: observation.acquiredAt,
    })
    .returning();

  await db.insert(incidentEvents).values({
    incidentId: incident.id,
    actorId: input.user.id,
    action: "Incident created from satellite detection",
    toStatus: "suspected",
    note: `Observation #${observation.id} linked. No burning classification has been made.`,
  });

  return incident;
}

export async function assignIncident(input) {
  const detail = await loadIncident(input.incidentId);
  assertDistrictScope(input.user, detail.districtId);

  const [assignee] = await db.select().from(users).where(eq(users.id, input.assigneeId)).limit(1);
  if (!assignee || !assignee.active) throw new ApiError(422, "Selected officer is not an active user");
  if (assignee.role !== "field_officer") throw new ApiError(422, "Incidents can only be assigned to field officers");
  if (input.user.role === "district_officer" && assignee.districtId !== input.user.districtId) {
    throw new ApiError(403, "You cannot assign incidents outside your district");
  }
  if (["confirmed", "closed"].includes(detail.status)) {
    throw new ApiError(409, "This incident is already finalised and cannot be reassigned");
  }

  const nextStatus = detail.status === "suspected" ? "assigned" : detail.status;
  const [updated] = await db
    .update(incidents)
    .set({ assignedToId: assignee.id, status: nextStatus, updatedAt: new Date() })
    .where(eq(incidents.id, input.incidentId))
    .returning();

  await db.insert(incidentEvents).values({
    incidentId: input.incidentId,
    actorId: input.user.id,
    action: "Assigned to field officer",
    fromStatus: detail.status,
    toStatus: nextStatus,
    note: input.note?.trim() || `Allocated to ${assignee.name} for field verification.`,
  });
  return updated;
}

export async function transitionIncident(input) {
  const detail = await loadIncident(input.incidentId);
  assertDistrictScope(input.user, detail.districtId);
  const from = detail.status;
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(input.toStatus)) {
    throw new ApiError(
      409,
      `Invalid transition from ${from.replaceAll("_", " ")} to ${input.toStatus.replaceAll("_", " ")}`,
    );
  }
  if (input.user.role === "field_officer") {
    if (detail.assignedToId !== input.user.id) throw new ApiError(403, "This incident is not assigned to you");
    if (input.toStatus === "closed") {
      throw new ApiError(403, "Only district or state administrators can close an incident");
    }
  }
  if ((input.toStatus === "confirmed" || input.toStatus === "unsubstantiated") && detail.reports.length === 0) {
    throw new ApiError(422, "A field verification report must be submitted before the incident can be finalised");
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: input.toStatus,
      resolutionSummary: input.resolutionSummary?.trim() || detail.resolutionSummary,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, input.incidentId))
    .returning();

  await db.insert(incidentEvents).values({
    incidentId: input.incidentId,
    actorId: input.user.id,
    action: `Status changed to ${input.toStatus.replaceAll("_", " ")}`,
    fromStatus: from,
    toStatus: input.toStatus,
    note: input.note?.trim() || null,
  });
  return updated;
}

export async function submitReport(input) {
  const detail = await loadIncident(input.incidentId);
  assertDistrictScope(input.user, detail.districtId);
  if (input.user.role === "field_officer" && detail.assignedToId !== input.user.id) {
    throw new ApiError(403, "You can only file reports for incidents assigned to you");
  }
  if (detail.status === "closed") throw new ApiError(409, "This incident is closed");

  const [report] = await db
    .insert(investigationReports)
    .values({
      incidentId: input.incidentId,
      investigatorId: input.user.id,
      findings: input.findings.trim(),
      causeClassification: input.causeClassification,
      areaBurnedHa: input.areaBurnedHa ?? null,
      cropAffected: input.cropAffected ?? null,
      evidenceUrls: (input.evidenceUrls ?? []).filter(Boolean).slice(0, 10),
      recommendation: input.recommendation?.trim() || null,
    })
    .returning();

  const nextStatus =
    detail.status === "suspected" || detail.status === "assigned" ? "under_investigation" : detail.status;

  if (nextStatus !== detail.status) {
    await db.update(incidents).set({ status: nextStatus, updatedAt: new Date() }).where(eq(incidents.id, detail.id));
  }
  await db.insert(incidentEvents).values({
    incidentId: input.incidentId,
    actorId: input.user.id,
    action: "Field verification report submitted",
    fromStatus: detail.status,
    toStatus: nextStatus,
    note: `${input.causeClassification}${
      input.areaBurnedHa ? ` · ${input.areaBurnedHa} ha affected` : ""
    }. Classification remains an administrative determination.`,
  });
  return report;
}

export async function loadIncident(id) {
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  if (!incident) throw new ApiError(404, "Incident not found");
  const [district] = await db.select().from(districts).where(eq(districts.id, incident.districtId)).limit(1);
  const [assignee] = incident.assignedToId
    ? await db.select().from(users).where(eq(users.id, incident.assignedToId)).limit(1)
    : [];
  const reports = await db
    .select()
    .from(investigationReports)
    .where(eq(investigationReports.incidentId, id))
    .orderBy(desc(investigationReports.submittedAt));
  const events = await db
    .select()
    .from(incidentEvents)
    .where(eq(incidentEvents.incidentId, id))
    .orderBy(desc(incidentEvents.createdAt));
  const [observation] = incident.observationId
    ? await db.select().from(observations).where(eq(observations.id, incident.observationId)).limit(1)
    : [];
  return {
    ...incident,
    district: district ?? null,
    assignee: assignee ?? null,
    reports,
    events,
    observation: observation ?? null,
  };
}

export async function activeFieldOfficers(districtId) {
  const where = districtId
    ? and(eq(users.role, "field_officer"), eq(users.active, true), eq(users.districtId, districtId))
    : and(eq(users.role, "field_officer"), eq(users.active, true));
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      districtId: users.districtId,
      designation: users.designation,
    })
    .from(users)
    .where(where)
    .orderBy(users.name);
}
