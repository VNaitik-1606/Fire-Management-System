import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  districts,
  incidentEvents,
  incidents,
  ingestRuns,
  investigationReports,
  observations,
  users,
} from "@/db/schema";
import { isoDate, daysAgo } from "@/lib/constants";

function obsScope(user) {
  if (user.role === "admin") return undefined;
  return eq(observations.districtId, user.districtId ?? -1);
}

function incScope(user) {
  if (user.role === "admin") return undefined;
  return eq(incidents.districtId, user.districtId ?? -1);
}

export async function getDistrictOptions() {
  return db
    .select({
      id: districts.id,
      code: districts.code,
      name: districts.name,
      state: districts.state,
      centerLat: districts.centerLat,
      centerLng: districts.centerLng,
      geometry: districts.geometry,
    })
    .from(districts)
    .orderBy(asc(districts.state), asc(districts.name));
}

export async function getOverview(user) {
  const sevenAgo = isoDate(daysAgo(7));
  const fourteenAgo = isoDate(daysAgo(14));
  const thirtyAgo = isoDate(daysAgo(30));

  const [obsStats] = await db
    .select({
      total: sql`count(*)::int`,
      last7: sql`count(*) filter (where ${observations.acqDate} >= ${sevenAgo})::int`,
      prev7: sql`count(*) filter (where ${observations.acqDate} >= ${fourteenAgo} and ${observations.acqDate} < ${sevenAgo})::int`,
      highConfidence: sql`count(*) filter (where ${observations.confidencePct} >= 80)::int`,
      avgFrp: sql`coalesce(avg(${observations.frp}), 0)::float`,
      frpSum: sql`coalesce(sum(${observations.frp}), 0)::float`,
      synthetic: sql`count(*) filter (where ${observations.isSynthetic})::int`,
      unassigned: sql`count(*) filter (where ${observations.districtId} is null)::int`,
    })
    .from(observations)
    .where(and(gte(observations.acqDate, thirtyAgo), obsScope(user)));

  const [incStats] = await db
    .select({
      total: sql`count(*)::int`,
      suspected: sql`count(*) filter (where ${incidents.status} = 'suspected')::int`,
      assigned: sql`count(*) filter (where ${incidents.status} = 'assigned')::int`,
      investigating: sql`count(*) filter (where ${incidents.status} = 'under_investigation')::int`,
      confirmed: sql`count(*) filter (where ${incidents.status} = 'confirmed')::int`,
      unsubstantiated: sql`count(*) filter (where ${incidents.status} = 'unsubstantiated')::int`,
      closed: sql`count(*) filter (where ${incidents.status} = 'closed')::int`,
      critical: sql`count(*) filter (where ${incidents.severity} = 'critical' and ${incidents.status} not in ('closed','unsubstantiated'))::int`,
      last7: sql`count(*) filter (where ${incidents.createdAt} >= now() - interval '7 days')::int`,
    })
    .from(incidents)
    .where(incScope(user));

  const [mine] = await db
    .select({ n: sql`count(*)::int` })
    .from(incidents)
    .where(and(eq(incidents.assignedToId, user.id), sql`${incidents.status} in ('assigned','under_investigation')`));

  return {
    observations: obsStats ?? {
      total: 0,
      last7: 0,
      prev7: 0,
      highConfidence: 0,
      avgFrp: 0,
      frpSum: 0,
      synthetic: 0,
      unassigned: 0,
    },
    incidents: incStats ?? {
      total: 0,
      suspected: 0,
      assigned: 0,
      investigating: 0,
      confirmed: 0,
      unsubstantiated: 0,
      closed: 0,
      critical: 0,
      last7: 0,
    },
    myOpenCases: Number(mine?.n ?? 0),
  };
}

export async function getDailySeries(user, days = 14) {
  const since = isoDate(daysAgo(days - 1));
  const detectionRows = await db
    .select({
      day: sql`${observations.acqDate}::text`,
      detections: sql`count(*)::int`,
      avgFrp: sql`coalesce(avg(${observations.frp}), 0)::float`,
    })
    .from(observations)
    .where(and(gte(observations.acqDate, since), obsScope(user)))
    .groupBy(observations.acqDate);

  const incidentRows = await db
    .select({
      day: sql`to_char(${incidents.createdAt}, 'YYYY-MM-DD')`,
      cases: sql`count(*)::int`,
      confirmed: sql`count(*) filter (where ${incidents.status} in ('confirmed','closed'))::int`,
    })
    .from(incidents)
    .where(and(incScope(user), sql`${incidents.createdAt} >= now() - (${days} || ' days')::interval`))
    .groupBy(sql`to_char(${incidents.createdAt}, 'YYYY-MM-DD')`);

  const detectionMap = new Map(detectionRows.map((r) => [r.day, r]));
  const incidentMap = new Map(incidentRows.map((r) => [r.day, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = daysAgo(i);
    const key = isoDate(d);
    const detection = detectionMap.get(key);
    const incident = incidentMap.get(key);
    series.push({
      day: key,
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }),
      detections: Number(detection?.detections ?? 0),
      avgFrp: Number(detection?.avgFrp ?? 0),
      cases: Number(incident?.cases ?? 0),
      confirmed: Number(incident?.confirmed ?? 0),
    });
  }
  return series;
}

export async function getDistrictStats(user, days = 30) {
  const since = isoDate(daysAgo(days));
  const obs = await db
    .select({
      districtId: observations.districtId,
      detections: sql`count(*)::int`,
      highConfidence: sql`count(*) filter (where ${observations.confidencePct} >= 80)::int`,
      avgFrp: sql`coalesce(avg(${observations.frp}), 0)::float`,
      lastDetection: sql`max(${observations.acqDate})::text`,
    })
    .from(observations)
    .where(and(gte(observations.acqDate, since), obsScope(user)))
    .groupBy(observations.districtId);

  const inc = await db
    .select({
      districtId: incidents.districtId,
      cases: sql`count(*)::int`,
      openCases: sql`count(*) filter (where ${incidents.status} in ('suspected','assigned','under_investigation'))::int`,
      confirmed: sql`count(*) filter (where ${incidents.status} in ('confirmed','closed'))::int`,
    })
    .from(incidents)
    .where(incScope(user))
    .groupBy(incidents.districtId);

  const allDistricts = await getDistrictOptions();
  const obsMap = new Map(obs.map((r) => [r.districtId, r]));
  const incMap = new Map(inc.map((r) => [r.districtId, r]));

  return allDistricts
    .filter((d) => user.role === "admin" || d.id === user.districtId)
    .map((district) => {
      const o = obsMap.get(district.id);
      const i = incMap.get(district.id);
      return {
        id: district.id,
        code: district.code,
        name: district.name,
        state: district.state,
        detections: Number(o?.detections ?? 0),
        highConfidence: Number(o?.highConfidence ?? 0),
        avgFrp: Number(o?.avgFrp ?? 0),
        lastDetection: o?.lastDetection ?? null,
        cases: Number(i?.cases ?? 0),
        openCases: Number(i?.openCases ?? 0),
        confirmed: Number(i?.confirmed ?? 0),
      };
    })
    .sort((a, b) => b.detections - a.detections);
}

export async function getStatusBreakdown(user) {
  const rows = await db
    .select({ status: incidents.status, n: sql`count(*)::int` })
    .from(incidents)
    .where(incScope(user))
    .groupBy(incidents.status);
  return rows.map((r) => ({ status: r.status, count: Number(r.n) }));
}

export async function getSourceBreakdown(user, days = 30) {
  const since = isoDate(daysAgo(days));
  const rows = await db
    .select({ source: observations.source, n: sql`count(*)::int` })
    .from(observations)
    .where(and(gte(observations.acqDate, since), obsScope(user)))
    .groupBy(observations.source)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => ({ source: r.source, count: Number(r.n) }));
}

export async function getHourlyPattern(user, days = 14) {
  const since = isoDate(daysAgo(days));
  const rows = await db
    .select({
      hour: sql`coalesce(nullif(substring(${observations.acqTime}, 1, 2), ''), '00')::int`,
      n: sql`count(*)::int`,
    })
    .from(observations)
    .where(and(gte(observations.acqDate, since), obsScope(user)))
    .groupBy(sql`coalesce(nullif(substring(${observations.acqTime}, 1, 2), ''), '00')::int`)
    .orderBy(asc(sql`coalesce(nullif(substring(${observations.acqTime}, 1, 2), ''), '00')::int`));
  return rows.map((r) => ({ hour: Number(r.hour), detections: Number(r.n) }));
}

export async function getRecentIncidents(user, limit = 8) {
  return db
    .select({
      id: incidents.id,
      reference: incidents.reference,
      status: incidents.status,
      severity: incidents.severity,
      latitude: incidents.latitude,
      longitude: incidents.longitude,
      detectedAt: incidents.detectedAt,
      createdAt: incidents.createdAt,
      cropType: incidents.cropType,
      districtName: districts.name,
      districtCode: districts.code,
      state: districts.state,
      assigneeName: users.name,
    })
    .from(incidents)
    .innerJoin(districts, eq(incidents.districtId, districts.id))
    .leftJoin(users, eq(incidents.assignedToId, users.id))
    .where(and(incScope(user), user.role === "field_officer" ? eq(incidents.assignedToId, user.id) : undefined))
    .orderBy(desc(incidents.createdAt))
    .limit(limit);
}

export async function listIncidents(user, filters) {
  const pageSize = Math.min(filters.pageSize ?? 20, 100);
  const page = Math.max(filters.page ?? 1, 1);
  const conditions = [incScope(user)];

  if (user.role === "field_officer") conditions.push(eq(incidents.assignedToId, user.id));
  if (filters.status && filters.status !== "all") conditions.push(eq(incidents.status, filters.status));
  if (filters.districtId) conditions.push(eq(incidents.districtId, filters.districtId));
  if (filters.assigneeId) conditions.push(eq(incidents.assignedToId, filters.assigneeId));
  if (filters.from) conditions.push(gte(incidents.createdAt, new Date(`${filters.from}T00:00:00Z`)));
  if (filters.to) conditions.push(lte(incidents.createdAt, new Date(`${filters.to}T23:59:59Z`)));
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(or(ilike(incidents.reference, term), ilike(incidents.summary, term), ilike(incidents.cropType, term)));
  }
  const where = and(...conditions);

  const rows = await db
    .select({
      id: incidents.id,
      reference: incidents.reference,
      status: incidents.status,
      severity: incidents.severity,
      latitude: incidents.latitude,
      longitude: incidents.longitude,
      detectedAt: incidents.detectedAt,
      createdAt: incidents.createdAt,
      cropType: incidents.cropType,
      suspectedCause: incidents.suspectedCause,
      districtName: districts.name,
      districtCode: districts.code,
      state: districts.state,
      assigneeName: users.name,
    })
    .from(incidents)
    .innerJoin(districts, eq(incidents.districtId, districts.id))
    .leftJoin(users, eq(incidents.assignedToId, users.id))
    .where(where)
    .orderBy(desc(incidents.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db.select({ n: sql`count(*)::int` }).from(incidents).where(where);

  return { rows, total: Number(totalRow?.n ?? 0), page, pageSize };
}

export async function listObservations(user, filters) {
  const conditions = [obsScope(user)];
  if (filters.from) conditions.push(gte(observations.acqDate, filters.from));
  if (filters.to) conditions.push(lte(observations.acqDate, filters.to));
  if (filters.districtId) conditions.push(eq(observations.districtId, filters.districtId));
  if (filters.minConfidence) conditions.push(gte(observations.confidencePct, filters.minConfidence));
  if (filters.minFrp) conditions.push(gte(observations.frp, filters.minFrp));
  if (filters.linked === "linked") {
    conditions.push(sql`exists (select 1 from ${incidents} i where i.observation_id = ${observations.id})`);
  }
  if (filters.linked === "unlinked") {
    conditions.push(sql`not exists (select 1 from ${incidents} i where i.observation_id = ${observations.id})`);
  }

  return db
    .select({
      id: observations.id,
      source: observations.source,
      satellite: observations.satellite,
      instrument: observations.instrument,
      latitude: observations.latitude,
      longitude: observations.longitude,
      brightness: observations.brightness,
      frp: observations.frp,
      confidencePct: observations.confidencePct,
      confidenceLabel: observations.confidenceLabel,
      acqDate: observations.acqDate,
      acqTime: observations.acqTime,
      acquiredAt: observations.acquiredAt,
      dayNight: observations.dayNight,
      isSynthetic: observations.isSynthetic,
      districtName: districts.name,
      districtCode: districts.code,
      districtId: observations.districtId,
      incidentId: sql`(select i.id from ${incidents} i where i.observation_id = ${observations.id} order by i.id limit 1)`,
      incidentRef: sql`(select i.reference from ${incidents} i where i.observation_id = ${observations.id} order by i.id limit 1)`,
      incidentStatus: sql`(select i.status from ${incidents} i where i.observation_id = ${observations.id} order by i.id limit 1)`,
    })
    .from(observations)
    .leftJoin(districts, eq(observations.districtId, districts.id))
    .where(and(...conditions))
    .orderBy(desc(observations.acquiredAt))
    .limit(Math.min(filters.limit ?? 400, 2000));
}

export async function getIngestRuns(limit = 8, user) {
  return db
    .select({
      id: ingestRuns.id,
      source: ingestRuns.source,
      bbox: ingestRuns.bbox,
      status: ingestRuns.status,
      fetched: ingestRuns.fetched,
      inserted: ingestRuns.inserted,
      duplicates: ingestRuns.duplicates,
      rejected: ingestRuns.rejected,
      message: ingestRuns.message,
      startedAt: ingestRuns.startedAt,
      finishedAt: ingestRuns.finishedAt,
      triggeredByName: users.name,
    })
    .from(ingestRuns)
    .leftJoin(users, eq(ingestRuns.triggeredById, users.id))
    .where(user && user.role === "district_officer" ? eq(ingestRuns.triggeredById, user.id) : undefined)
    .orderBy(desc(ingestRuns.startedAt))
    .limit(limit);
}

export async function getAuditTrail(limit = 25, user) {
  return db
    .select({
      id: incidentEvents.id,
      action: incidentEvents.action,
      fromStatus: incidentEvents.fromStatus,
      toStatus: incidentEvents.toStatus,
      note: incidentEvents.note,
      createdAt: incidentEvents.createdAt,
      incidentId: incidentEvents.incidentId,
      incidentReference: incidents.reference,
      districtName: districts.name,
      actorName: users.name,
      actorRole: users.role,
    })
    .from(incidentEvents)
    .innerJoin(incidents, eq(incidentEvents.incidentId, incidents.id))
    .innerJoin(districts, eq(incidents.districtId, districts.id))
    .leftJoin(users, eq(incidentEvents.actorId, users.id))
    .where(user && user.role !== "admin" ? eq(incidents.districtId, user.districtId ?? -1) : undefined)
    .orderBy(desc(incidentEvents.createdAt))
    .limit(limit);
}

export async function getUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
      active: users.active,
      createdAt: users.createdAt,
      districtName: districts.name,
      districtCode: districts.code,
    })
    .from(users)
    .leftJoin(districts, eq(users.districtId, districts.id))
    .orderBy(asc(users.role), asc(users.name));
}

export async function getAnalytics(user, days = 30) {
  const [daily, districtStats, statuses, sources, hourly, causes, overview] = await Promise.all([
    getDailySeries(user, days),
    getDistrictStats(user, days),
    getStatusBreakdown(user),
    getSourceBreakdown(user, days),
    getHourlyPattern(user, 14),
    db
      .select({
        cause: investigationReports.causeClassification,
        n: sql`count(*)::int`,
        area: sql`coalesce(sum(${investigationReports.areaBurnedHa}), 0)::float`,
      })
      .from(investigationReports)
      .innerJoin(incidents, eq(investigationReports.incidentId, incidents.id))
      .where(incScope(user))
      .groupBy(investigationReports.causeClassification)
      .orderBy(desc(sql`count(*)`)),
    getOverview(user),
  ]);

  const resolved = await db
    .select({ createdAt: incidents.createdAt, updatedAt: incidents.updatedAt, status: incidents.status })
    .from(incidents)
    .where(and(incScope(user), sql`${incidents.status} in ('confirmed','unsubstantiated','closed')`));

  const avgResolutionHours =
    resolved.length === 0
      ? 0
      : resolved.reduce((sum, r) => sum + (r.updatedAt.getTime() - r.createdAt.getTime()) / 3600000, 0) / resolved.length;

  return {
    daily,
    districtStats,
    statuses,
    sources,
    hourly,
    causes: causes.map((c) => ({ cause: c.cause, count: Number(c.n), area: Number(c.area) })),
    overview,
    avgResolutionHours,
    resolvedCount: resolved.length,
  };
}

export async function getObservationById(id) {
  const [row] = await db
    .select({
      id: observations.id,
      source: observations.source,
      satellite: observations.satellite,
      instrument: observations.instrument,
      latitude: observations.latitude,
      longitude: observations.longitude,
      brightness: observations.brightness,
      frp: observations.frp,
      confidencePct: observations.confidencePct,
      confidenceLabel: observations.confidenceLabel,
      acqDate: observations.acqDate,
      acqTime: observations.acqTime,
      acquiredAt: observations.acquiredAt,
      dayNight: observations.dayNight,
      isSynthetic: observations.isSynthetic,
      districtId: observations.districtId,
      districtName: districts.name,
      districtCode: districts.code,
    })
    .from(observations)
    .leftJoin(districts, eq(observations.districtId, districts.id))
    .where(eq(observations.id, id))
    .limit(1);
  return row ?? null;
}

export async function getPendingAssignmentCount(user) {
  const [row] = await db
    .select({ n: sql`count(*)::int` })
    .from(incidents)
    .where(and(incScope(user), sql`${incidents.status} = 'suspected'`));
  return Number(row?.n ?? 0);
}

export async function getCountsForNav(user) {
  const [pending, mine] = await Promise.all([
    getPendingAssignmentCount(user),
    db
      .select({ n: sql`count(*)::int` })
      .from(incidents)
      .where(and(eq(incidents.assignedToId, user.id), sql`${incidents.status} in ('assigned','under_investigation')`)),
  ]);
  return { pendingAssignment: pending, myOpen: Number(mine[0]?.n ?? 0) };
}

export async function getDistrictById(id) {
  const [row] = await db.select().from(districts).where(eq(districts.id, id)).limit(1);
  return row ?? null;
}

export async function countObservationsWithoutDistrict() {
  const [row] = await db.select({ n: count() }).from(observations).where(sql`${observations.districtId} is null`);
  return Number(row?.n ?? 0);
}
