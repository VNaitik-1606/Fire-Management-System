import "server-only";

let validated = false;

/**
 * Validates required backend environment variables on startup and fails fast
 * with clear, actionable messages when mandatory configuration is missing.
 */
export function validateBackendEnv() {
  const errors = [];

  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    errors.push("DATABASE_URL is missing. Set a valid PostgreSQL connection string in .env.");
  }

  if (errors.length > 0) {
    throw new Error(`[env] Invalid backend configuration:\n- ${errors.join("\n- ")}`);
  }

  if (!validated && process.env.NODE_ENV !== "test") {
    validated = true;
    const firmsKey = process.env.FIRMS_API_KEY || process.env.FIRMS_MAP_KEY || process.env.NASA_FIRMS_MAP_KEY;
    if (!firmsKey) {
      console.warn(
        "[env] FIRMS_API_KEY is not configured. Live NASA FIRMS ingestion will remain disabled; simulated demo mode is active.",
      );
    }
  }
}

export function getFirmsApiKey() {
  return process.env.FIRMS_API_KEY || process.env.FIRMS_MAP_KEY || process.env.NASA_FIRMS_MAP_KEY || null;
}
