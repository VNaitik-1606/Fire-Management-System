import { CAUSES, CROPS, INCIDENT_STATUSES, SEVERITIES } from "@/lib/constants";

export const statusValues = INCIDENT_STATUSES.map((s) => s.value);
export const severityValues = SEVERITIES.map((s) => s.value);
export const INVESTIGATION_CAUSES = [...CAUSES];
export const CROP_OPTIONS = [...CROPS];
