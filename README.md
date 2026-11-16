# FireWatch India — Satellite-Based Fire & Crop Burning Monitoring System

An administrative geospatial incident-management platform built for state and district authorities in India to monitor NASA FIRMS satellite fire detections, geofence hotspots to administrative districts, assign field investigations, and maintain an auditable record of enforcement actions.

---

## 1. Project Overview & Objectives

Agricultural residue burning requires coordinated verification across state pollution control boards, district revenue/agriculture officers, and block-level field officials. Satellite thermal anomalies alone cannot legally establish crop residue burning.

**Objectives:**
- Ingest satellite thermal anomalies from the **NASA FIRMS Area API** (VIIRS SNPP, NOAA-20, NOAA-21, and MODIS) with schema validation and duplicate prevention.
- Geofence raw coordinates against district boundary GeoJSON polygons without guessing jurisdictions for out-of-bounds detections.
- Visualize hotspots, clusters, district overlays, and **NASA GIBS** true-colour imagery in an interactive **MapLibre GL JS** map.
- Keep **satellite observations** strictly separate from **administrative incidents**; never auto-classify a thermal anomaly as confirmed crop burning.
- Route raised incidents through a role-based workflow (`suspected` → `assigned` → `under_investigation` → `confirmed` / `unsubstantiated` → `closed`) with mandatory field verification reports and an immutable audit trail.
- Compute district-level and time-series analytics directly from stored database records.

---

## 2. Technology Stack

This codebase is written **exclusively in JavaScript (`.js` / `.jsx`)** with no TypeScript source files.

| Layer | Technology |
| --- | --- |
| **Frontend Framework** | Next.js 16 (App Router), React 19, JavaScript (`.jsx`) |
| **Styling** | Tailwind CSS v4 |
| **Geospatial Mapping** | MapLibre GL JS, GeoJSON, NASA GIBS WMTS tiles |
| **Data Visualization** | Recharts |
| **Backend API** | Next.js Route Handlers (`src/app/api/**/route.js`), Node.js, Zod validation |
| **Database & ORM** | PostgreSQL (`pg`), Drizzle ORM (`drizzle-orm`, `drizzle-kit`) |
| **Authentication** | Scrypt salted password hashing + HTTP-only opaque session cookies |
| **External Data** | NASA FIRMS Area API, NASA GIBS, District Boundary GeoJSON |

> **Stack Adaptation Note:** The sandbox provisions PostgreSQL and Next.js App Router rather than Express + MongoDB Atlas. The same clean separation of concerns (REST API layer, server-only external API clients, database schema, RBAC enforcement at every endpoint, and cron-triggerable ingestion endpoint) is preserved on PostgreSQL + Drizzle ORM.

---

## 3. Project Directory Structure

```text
.
├── .env                        # Local runtime environment variables (gitignored)
├── .env.example                # Template environment file with placeholders
├── .gitignore                  # Excludes secrets, build artifacts, and node_modules
├── drizzle.config.json         # Drizzle Kit configuration (points to src/db/schema.js)
├── eslint.config.mjs           # ESLint flat configuration
├── jsconfig.json               # JavaScript path alias (@/* -> ./src/*)
├── next.config.mjs             # Next.js JavaScript configuration
├── package.json                # Dependencies and npm scripts
├── public/
│   └── images/
│       └── satellite-fires.jpg # Login screen visual asset
└── src/
    ├── app/
    │   ├── globals.css         # Tailwind CSS v4 theme & component utilities
    │   ├── layout.jsx          # Root HTML layout & font loading
    │   ├── login/page.jsx      # Administrative sign-in page
    │   ├── (app)/              # Authenticated dashboard layout & views
    │   │   ├── layout.jsx      # Server session check & AppShell wrapper
    │   │   ├── page.jsx        # State / District Command Centre dashboard
    │   │   ├── map/page.jsx    # Interactive MapLibre + NASA GIBS workspace
    │   │   ├── incidents/
    │   │   │   ├── page.jsx    # Filterable & paginated incident register
    │   │   │   └── [id]/page.jsx # Case detail, provenance, reports & audit log
    │   │   ├── analytics/page.jsx # District & diurnal analytics charts
    │   │   └── admin/page.jsx  # Staff, district coverage, ingestion & provenance
    │   └── api/                # REST API route handlers (JavaScript)
    │       ├── health/route.js
    │       ├── auth/{login,logout,me}/route.js
    │       ├── observations/route.js
    │       ├── districts/route.js
    │       ├── ingest/route.js
    │       ├── cron/ingest/route.js
    │       ├── incidents/route.js
    │       ├── incidents/[id]/route.js
    │       ├── incidents/[id]/reports/route.js
    │       └── analytics/route.js
    ├── components/             # React UI components (.jsx)
    │   ├── AppShell.jsx
    │   ├── FireMap.jsx
    │   ├── IncidentActions.jsx
    │   ├── IncidentFilters.jsx
    │   ├── IngestPanel.jsx
    │   ├── LoginForm.jsx
    │   ├── PageHeader.jsx
    │   ├── charts.jsx
    │   ├── icons.jsx
    │   └── ui.jsx
    ├── db/
    │   ├── index.js            # PostgreSQL pool + Drizzle client + env validation
    │   └── schema.js           # Relational tables & indexes
    └── lib/                    # Server & domain logic (.js)
        ├── api.js              # API response helpers & central error boundary
        ├── auth.js             # Password hashing, session management, RBAC guards
        ├── constants.js        # Roles, workflow state machine, formatting helpers
        ├── districts-data.js   # Pilot district boundary definitions
        ├── env.js              # Startup environment variable validation
        ├── firms.js            # NASA FIRMS Area API client & CSV validator
        ├── geo.js              # Point-in-polygon geofencing & geometry helpers
        ├── incidents.js        # Incident lifecycle & report services
        ├── ingest.js           # Fetch -> validate -> geofence -> dedupe pipeline
        ├── queries.js          # Role-scoped queries & analytics aggregations
        ├── seed.js             # Idempotent database bootstrap & demo fixtures
        └── validation.js       # Shared workflow validation lists
```

---

## 4. Prerequisites & Required Software

- **Node.js** v20.x or v22.x
- **npm** v10+
- **PostgreSQL** v15+ (running locally or hosted)
- **NASA FIRMS Map Key** *(optional for demo mode; required for live satellite ingestion)* — request at [https://firms.modaps.eosdis.nasa.gov/api/map_key/](https://firms.modaps.eosdis.nasa.gov/api/map_key/)

---

## 5. Installation Instructions

1. Clone or open the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your environment file from the template:
   ```bash
   cp .env.example .env
   ```
4. Update `.env` with your PostgreSQL connection string and optional keys (see Section 6).

---

## 6. Environment Variable Configuration

Every environment variable is validated on backend startup in `src/lib/env.js`. Missing mandatory variables throw a descriptive startup error before any database query runs.

| Variable | Required | Exposure | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | Server only | PostgreSQL connection string (e.g. `postgresql://postgres:postgres@127.0.0.1:5432/app_db`) |
| `PORT` | No | Server only | HTTP server port (defaults to `3000`) |
| `NODE_ENV` | No | Runtime | Managed by Next.js (`development` or `production`) |
| `FRONTEND_URL` | No | Server only | Base origin URL for deployment reference (`http://localhost:3000`) |
| `FIRMS_API_KEY` | No | Server only | NASA FIRMS API key (`FIRMS_MAP_KEY` also accepted). Never prefixed with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | No | Server only | Bearer token required by `POST /api/cron/ingest` for automated scheduler runs |
| `SESSION_SECRET` | No | Server only | Reserved secret for production token/signing deployments |

**Security rule:** No secret variable uses the `NEXT_PUBLIC_` prefix. All NASA FIRMS requests are proxied server-side.

---

## 7. Database Setup Instructions (PostgreSQL & Drizzle)

1. Ensure PostgreSQL is running and `app_db` exists:
   ```bash
   createdb -U postgres app_db
   ```
   *(If `app_db` already exists, skip this step.)*
2. Push the schema defined in `src/db/schema.js`:
   ```bash
   npx drizzle-kit push --config=drizzle.config.json
   ```
3. Verify tables in PostgreSQL:
   ```bash
   psql "$DATABASE_URL" -c "\dt"
   ```
   Expected tables: `districts`, `users`, `sessions`, `observations`, `incidents`, `incident_events`, `investigation_reports`, `ingest_runs`.
4. **Automatic Seeding:** On the first request to `/login` or `/api/*`, `ensureSeeded()` idempotently populates 14 Punjab & Haryana district polygons, 10 staff accounts, 800+ geofenced demo detections (`is_synthetic = true`), and sample incident workflows if `districts` is empty.

---

## 8. Backend & Frontend Setup and Execution

Because Next.js App Router serves both the backend REST API (`src/app/api/**`) and React frontend (`src/app/**`), a single server process runs both layers together.

### Development Mode
```bash
npm run dev
```
Starts the frontend UI and backend API routes on `http://localhost:3000`.

### Production Build & Execution
```bash
npm run build
npm run start
```

### Code Quality & Linting
```bash
npm run lint
```

---

## 9. Running the Complete Application

1. Start PostgreSQL and ensure `DATABASE_URL` in `.env` is valid.
2. Push schema changes:
   ```bash
   npx drizzle-kit push --config=drizzle.config.json
   ```
3. Build and start the server:
   ```bash
   npm run build && npm run start
   ```
4. Open `http://localhost:3000` in your browser. Unauthenticated users are redirected to `/login`.

### Demonstration Accounts
Password for all demo accounts: **`Firewatch@2026`**

| Role | Email | Scope |
| --- | --- | --- |
| State Administrator | `admin@firewatch.gov.in` | Statewide (Punjab & Haryana), admin console |
| District Officer | `ludhiana.do@firewatch.gov.in` | Ludhiana district only |
| District Officer | `karnal.do@firewatch.gov.in` | Karnal district only |
| Field Officer | `amanpreet.fo@firewatch.gov.in` | Assigned incidents in Ludhiana only |

---

## 10. Available API Endpoints

All endpoints (except `/api/health`, `/api/auth/login`, and `/api/cron/ingest`) require an authenticated session cookie. District/field scoping is enforced server-side.

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Verifies database connectivity and FIRMS key status |
| `POST` | `/api/auth/login` | Public | Authenticates user and sets HTTP-only session cookie |
| `POST` | `/api/auth/logout` | Authenticated | Destroys active session cookie |
| `GET` | `/api/auth/me` | Authenticated | Returns current signed-in official profile |
| `GET` | `/api/observations` | Authenticated | Returns detections (`format=json` or `format=geojson`, filters: `from`, `to`, `districtId`, `minConfidence`, `linked`) |
| `GET` | `/api/districts` | Authenticated | Returns district polygons and 30-day detection/case totals |
| `GET` | `/api/ingest` | Authenticated | Lists recent satellite ingestion audit runs |
| `POST` | `/api/ingest` | Admin, District Officer | Triggers `live` (NASA FIRMS) or `simulate` ingestion pipeline |
| `POST` | `/api/cron/ingest` | `Bearer $CRON_SECRET` | Scheduler endpoint for automated cron-based ingestion |
| `GET` | `/api/incidents` | Authenticated | Lists role-scoped incidents with search, filter, and pagination |
| `POST` | `/api/incidents` | Admin, District Officer | Raises a `suspected` incident from an observation ID |
| `GET` | `/api/incidents/:id` | Scoped | Fetches full incident, observation provenance, reports, and audit trail |
| `PATCH` | `/api/incidents/:id` | Scoped | Assigns a field officer (`action: "assign"`) or updates workflow status (`action: "status"`) |
| `POST` | `/api/incidents/:id/reports` | Scoped | Submits a field verification report (`findings`, `causeClassification`, `areaBurnedHa`, `evidenceUrls`) |
| `GET` | `/api/analytics` | Authenticated | Returns daily series, district load, hourly pattern, and causes (`?days=30`) |

---

## 11. Testing Instructions

1. **Check API health:**
   ```bash
   curl -s http://localhost:3000/api/health
   ```
2. **Verify unauthenticated access is blocked (`401`):**
   ```bash
   curl -i http://localhost:3000/api/incidents
   ```
3. **Sign in and query GeoJSON observations:**
   ```bash
   curl -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@firewatch.gov.in","password":"Firewatch@2026"}'

   curl -b /tmp/cookies.txt "http://localhost:3000/api/observations?format=geojson&limit=5"
   ```
4. **Verify lint and production build:**
   ```bash
   npm run lint
   npm run build
   ```

---

## 12. Common Errors & Troubleshooting

- **`[env] Invalid backend configuration: DATABASE_URL is missing`**
  Ensure `.env` exists in the project root and contains a valid `DATABASE_URL`.
- **`FIRMS_API_KEY is not configured` on live ingestion**
  Set `FIRMS_API_KEY=<your_key>` in `.env` and restart the server, or use `Simulated` mode in the ingestion panel for demonstration.
- **`A field verification report must be submitted before the incident can be finalised` (`422`)**
  By design, an incident cannot be moved to `confirmed` or `unsubstantiated` until a field verification report has been submitted under `POST /api/incidents/:id/reports`.
- **Map tiles or NASA GIBS imagery blank**
  Verify outbound HTTPS connectivity to `basemaps.cartocdn.com` and `gibs.earthdata.nasa.gov`, and ensure the selected GIBS imagery date is at least 1–2 days prior to today when today's global mosaic is still processing.

---

## 13. Security Considerations

- **Credential isolation:** `FIRMS_API_KEY`, `CRON_SECRET`, and `DATABASE_URL` are accessed exclusively in server modules (`import "server-only"`) and never exposed to client bundles.
- **Password & session security:** Passwords use Node `crypto.scryptSync` with per-user 16-byte random salts and `timingSafeEqual` verification. Sessions use 32-byte random opaque tokens stored in HTTP-only, `SameSite=Lax` cookies.
- **API-level RBAC:** Every route handler verifies session identity, role permissions, and district boundaries (`assertDistrictScope`) independently of frontend UI visibility.
- **Input validation:** All API payloads and external NASA FIRMS CSV rows are validated with `zod` prior to database persistence.
- **Data provenance & human oversight:** Synthetic fixture rows are explicitly flagged (`is_synthetic = true`) and displayed with demo banners; no automated process can classify a thermal anomaly as confirmed crop burning.
