import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth";

export function ok(data, init) {
  return NextResponse.json(data, init);
}

/**
 * Central API error boundary. Internal errors are logged server-side and never
 * leaked to callers as stack traces or driver messages.
 */
export async function apiHandler(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    console.error("[api] unhandled error", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export function parseNumber(value, fallback) {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
