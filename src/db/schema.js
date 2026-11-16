import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * District administrative boundaries (simplified GeoJSON polygons).
 * Districts are the reference geography used for geofencing satellite detections.
 */
export const districts = pgTable(
  "districts",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    state: text("state").notNull(),
    geometry: jsonb("geometry").notNull(),
    centerLat: doublePrecision("center_lat").notNull(),
    centerLng: doublePrecision("center_lng").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("districts_code_key").on(table.code)],
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    // admin | district_officer | field_officer
    role: text("role").notNull().default("field_officer"),
    designation: text("designation"),
    districtId: integer("district_id").references(() => districts.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Raw satellite detections. These are observations, NOT incidents.
 * Nothing in the pipeline is allowed to promote an observation to a
 * confirmed burning incident without a human administrative action.
 */
export const observations = pgTable(
  "observations",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull().default("VIIRS_SNPP_NRT"),
    satellite: text("satellite"),
    instrument: text("instrument"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    brightness: doublePrecision("brightness"),
    frp: doublePrecision("frp"),
    confidencePct: integer("confidence_pct"),
    confidenceLabel: text("confidence_label"),
    acqDate: date("acq_date").notNull(),
    acqTime: text("acq_time"),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull(),
    dayNight: text("day_night"),
    districtId: integer("district_id").references(() => districts.id, { onDelete: "set null" }),
    dedupeKey: text("dedupe_key").notNull(),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload"),
  },
  (table) => [
    uniqueIndex("observations_dedupe_key").on(table.dedupeKey),
    index("observations_acq_date_idx").on(table.acqDate),
    index("observations_district_idx").on(table.districtId),
  ],
);

export const incidents = pgTable(
  "incidents",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull(),
    observationId: integer("observation_id").references(() => observations.id, { onDelete: "set null" }),
    districtId: integer("district_id")
      .notNull()
      .references(() => districts.id),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    // suspected | assigned | under_investigation | confirmed | unsubstantiated | closed
    status: text("status").notNull().default("suspected"),
    // low | medium | high | critical
    severity: text("severity").notNull().default("medium"),
    landUse: text("land_use"),
    cropType: text("crop_type"),
    suspectedCause: text("suspected_cause"),
    summary: text("summary"),
    resolutionSummary: text("resolution_summary"),
    assignedToId: integer("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("incidents_reference_key").on(table.reference),
    index("incidents_status_idx").on(table.status),
    index("incidents_district_idx").on(table.districtId),
  ],
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("incident_events_incident_idx").on(table.incidentId)],
);

export const investigationReports = pgTable(
  "investigation_reports",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    investigatorId: integer("investigator_id").references(() => users.id, { onDelete: "set null" }),
    findings: text("findings").notNull(),
    causeClassification: text("cause_classification").notNull(),
    areaBurnedHa: doublePrecision("area_burned_ha"),
    cropAffected: text("crop_affected"),
    evidenceUrls: jsonb("evidence_urls").notNull().default([]),
    recommendation: text("recommendation"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reports_incident_idx").on(table.incidentId)],
);

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  bbox: text("bbox").notNull(),
  // running | success | failed
  status: text("status").notNull().default("running"),
  fetched: integer("fetched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  message: text("message"),
  triggeredById: integer("triggered_by_id").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
