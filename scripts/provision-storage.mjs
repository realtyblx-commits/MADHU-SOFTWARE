/**
 * Provisions Supabase Storage buckets for BLX Realty Payroll.
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env — creates buckets only
 * (RLS policies must be applied via SQL migration).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const raw = readFileSync(envPath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv();
const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const BUCKETS = [
  {
    id: "company-assets",
    name: "company-assets",
    public: true,
    file_size_limit: 5 * 1024 * 1024,
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  },
  {
    id: "employee-photos",
    name: "employee-photos",
    public: false,
    file_size_limit: 5 * 1024 * 1024,
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
  },
  {
    id: "employee-kyc",
    name: "employee-kyc",
    public: false,
    file_size_limit: 15 * 1024 * 1024,
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  {
    id: "employee-documents",
    name: "employee-documents",
    public: false,
    file_size_limit: 15 * 1024 * 1024,
    allowed_mime_types: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  {
    id: "payslips",
    name: "payslips",
    public: false,
    file_size_limit: 20 * 1024 * 1024,
    allowed_mime_types: ["application/pdf"],
  },
];

async function listBuckets() {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!res.ok) throw new Error(`List buckets failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createOrUpdateBucket(bucket) {
  const existing = await listBuckets();
  const found = (existing || []).find((b) => b.id === bucket.id || b.name === bucket.name);

  if (found) {
    const res = await fetch(`${url}/storage/v1/bucket/${bucket.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public: bucket.public,
        file_size_limit: bucket.file_size_limit,
        allowed_mime_types: bucket.allowed_mime_types,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      // Some projects only support POST create; treat update failures as soft
      console.warn(`  update ${bucket.id}: ${res.status} ${text}`);
      return "exists";
    }
    return "updated";
  }

  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bucket),
  });
  if (!res.ok) throw new Error(`Create ${bucket.id} failed: ${res.status} ${await res.text()}`);
  return "created";
}

async function main() {
  console.log(`Provisioning storage on ${url}`);
  for (const bucket of BUCKETS) {
    const status = await createOrUpdateBucket(bucket);
    console.log(`  ${bucket.id} (${bucket.public ? "PUBLIC" : "PRIVATE"}): ${status}`);
  }
  const final = await listBuckets();
  console.log("\nBuckets now:");
  for (const b of final) {
    console.log(`  - ${b.id || b.name} public=${b.public}`);
  }
  console.log(
    "\nNext: run supabase/migrations/20260322_storage_buckets_secure.sql in the Supabase SQL Editor to apply RLS policies."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
