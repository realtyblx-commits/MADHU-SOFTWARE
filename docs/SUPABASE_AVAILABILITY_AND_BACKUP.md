# Supabase Free Plan Availability, Keep-Alive & Backup SOP
**Project:** BLX Realty Payroll Suite  
**Database Project ID:** `eccoqnsmbebmumxuhhkv`  
**Hosting Environment:** Supabase Free Tier  

---

## 1. Architectural Philosophy: Minimal Resource Consumption

The BLX Realty Payroll Suite is specifically optimized for low human usage (processed 1–2 times per month) on the Supabase Free Tier:

- **Zero Aggressive Polling:** No continuous `setInterval` loops or background pings from browser tabs.
- **Zero Dummy Data:** No fake attendance, fake employees, or dummy records are ever generated.
- **Zero Storage Abuse:** PDFs and images are uploaded strictly on genuine action, stored once, and deleted when the associated record is removed.
- **Pure Read-Only Health Probes:** Probes query at most a single row (`company_settings?select=id&limit=1`) to confirm backend reachability without modifying any business state.

---

## 2. The `/api/health` Endpoint

A high-speed, lightweight endpoint is available on both local dev and production serverless environments:

- **Path:** `GET /api/health`
- **Method:** `GET`, `HEAD`, `OPTIONS`
- **Authentication Required:** None (public probe)
- **Sensitive Data Leaked:** None (zero credentials, zero employee records)

### Sample Output:
```json
{
  "status": "ok",
  "timestamp": "2026-09-03T04:18:52.197Z",
  "service": "BLX Realty Payroll Suite",
  "database": "connected"
}
```

If Supabase is temporarily paused or initializing:
```json
{
  "status": "ok",
  "timestamp": "2026-09-03T04:18:52.197Z",
  "service": "BLX Realty Payroll Suite",
  "database": "paused_or_initializing"
}
```

---

## 3. External Scheduler / Keep-Alive Configuration

Supabase Free Tier pauses projects after **7 consecutive days of inactivity**. This project pings the database every **5 minutes** with a **read-only** probe so the project stays warm without depending on user traffic.

### Option A: GitHub Actions (Recommended)
Workflow: [`.github/workflows/keep-alive.yml`](../.github/workflows/keep-alive.yml)  
Script: [`scripts/supabase-keep-alive.mjs`](../scripts/supabase-keep-alive.mjs)

- **Schedule:** every 5 minutes (`cron: '*/5 * * * *'`), plus manual `workflow_dispatch`.
- **Probe:** `GET /rest/v1/company_settings?select=id&limit=1` (no inserts/updates/deletes).
- **Credentials:** GitHub Actions secrets only (never client-side, never service-role for this job):
  - `SUPABASE_ANON_KEY` (required) — publishable anon key
  - `SUPABASE_URL` (optional) — defaults to this project URL
  - `APP_HEALTH_URL` (optional) — e.g. `https://your-app.vercel.app/api/health`

Local smoke test:

```bash
node scripts/supabase-keep-alive.mjs
```

### Option B: Free Cron Monitor (e.g. cron-job.org)
1. Register at [cron-job.org](https://cron-job.org).
2. Create a job every 5 minutes against `https://your-domain.com/api/health`, **or** the same Supabase REST URL with anon headers (`apikey` + `Authorization: Bearer`).

### Option C: UptimeRobot
- Monitor Type: **HTTP(s)**
- URL: `https://your-domain.com/api/health`
- Interval: as frequent as your plan allows (prefer GitHub Actions for the 5‑minute DB probe).

---

## 4. Pause Detection & Graceful Fallback

If Supabase is paused or asleep when an employee or manager accesses the system:

1. **Non-Crashing Catch Boundary:** The application catches HTTP 503 or `project_paused` response codes.
2. **User-Friendly Notice:** A polite notification displays:  
   *"Payroll services are temporarily unavailable. Please try again shortly."*
3. **No Hammering:** Repeated failures are debounced for 45 seconds to prevent spamming requests against a waking database.
4. **Local Continuity:** The application continues to render historical views and offline cached state instead of rendering a broken white screen.

---

## 5. Backup & Disaster Recovery Strategy

Because payroll is critical financial data, do not rely on cloud storage alone.

### Recommended Routine (Before Monthly Payroll):
1. Navigate to **Settings** (`/settings`).
2. Scroll to the **Database Backup & Disaster Recovery** card.
3. Click **Download JSON Backup**.
   - Generates `blx_payroll_backup_YYYY-MM-DD.json` containing complete relational snapshots of:
     - `company_settings`
     - `employees` (including KYC metadata and document storage URLs)
     - `attendance` records & computed metrics
     - `payroll` calculations & period runs
     - `payslips` immutable snapshot history
     - `audit_logs`
4. Store the JSON backup in your company's secure offsite archive (Google Drive, local secure drive).
5. Click **CSV Export** for Employee Roster and Payslip History for spreadsheet record-keeping.

### Restoring from Backup:
If the Supabase project is ever reset or migrated:
1. Re-run [`supabase/schema.sql`](../supabase/schema.sql) in the new Supabase SQL Editor.
2. Re-import tables using the JSON snapshot.
