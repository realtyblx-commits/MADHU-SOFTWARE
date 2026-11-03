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

Supabase Free Tier pauses projects after **7 consecutive days of inactivity**. To ensure availability for monthly payroll runs without over-querying, a low-frequency probe every **3 days** is recommended.

### Option A: GitHub Actions (Recommended — Zero Third-Party Setup)
A workflow is pre-configured at [`.github/workflows/keep-alive.yml`](../.github/workflows/keep-alive.yml):
- **Schedule:** Runs every 3 days at 06:00 UTC (`cron: '0 6 */3 * *'`).
- **Secrets to configure (in GitHub Repo → Settings → Secrets & Variables → Actions):**
  - `SUPABASE_ANON_KEY`: Your project publishable anon key.
  - `SUPABASE_URL`: `https://eccoqnsmbebmumxuhhkv.supabase.co` (Optional, defaults to your project).
  - `APP_HEALTH_URL`: `https://your-deployed-app.com/api/health` (Optional).

### Option B: Free Cron Monitor (e.g. cron-job.org)
1. Register a free account at [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **URL:** `https://your-domain.com/api/health` (or direct Supabase REST endpoint: `https://eccoqnsmbebmumxuhhkv.supabase.co/rest/v1/company_settings?select=id&limit=1`).
   - **Schedule:** Every 3 days (e.g., At 08:00 AM, Day 1, 4, 7, 10...).
   - **Method:** `GET`
   - **Headers:** (If calling Supabase direct)
     - `apikey: <YOUR_ANON_KEY>`
     - `Authorization: Bearer <YOUR_ANON_KEY>`

### Option C: UptimeRobot
- Monitor Type: **HTTP(s)**
- URL: `https://your-domain.com/api/health`
- Interval: Set to the maximum free interval (e.g. daily or custom low frequency).

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
