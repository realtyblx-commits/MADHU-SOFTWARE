import { supabase } from "@/integrations/supabase/client";

/**
 * Storage Buckets (Supabase only — never local JSON / base64 persistence)
 *
 * PUBLIC
 *   company-assets      — logos, authorized signatures
 *
 * PRIVATE (signed URLs only)
 *   employee-photos     — passport / profile photos
 *   employee-kyc        — Aadhaar, PAN, bank passbook
 *   employee-documents  — offer letters & other HR docs
 *   payslips            — salary PDFs
 */

export const STORAGE_BUCKETS = {
  companyAssets: "company-assets",
  employeePhotos: "employee-photos",
  employeeKyc: "employee-kyc",
  employeeDocuments: "employee-documents",
  payslips: "payslips",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const PUBLIC_BUCKETS = new Set<string>([STORAGE_BUCKETS.companyAssets]);

const KYC_SLOTS = new Set([
  "aadhaar_card_doc",
  "pan_card_doc",
  "bank_passbook_doc",
  "aadhaar",
  "pan",
  "bank_passbook",
]);

export interface StorageUploadResult {
  bucket: StorageBucket;
  path: string;
  /** Durable DB reference: `bucket::path` (never base64 / never signed URL) */
  ref: string;
  /** Short-lived view URL for immediate UI use */
  url: string;
  sizeBytes?: number;
  fileSizeFormatted?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Encode a durable storage pointer for Postgres columns / jsonb. */
export function encodeStorageRef(bucket: string, path: string): string {
  return `${bucket}::${path}`;
}

/** Parse a DB storage pointer. Also accepts legacy bare paths / public URLs. */
export function parseStorageRef(
  value: string | null | undefined,
  fallbackBucket?: StorageBucket
): { bucket: string; path: string } | null {
  if (!value || value.startsWith("data:")) return null;

  if (value.includes("::")) {
    const idx = value.indexOf("::");
    const bucket = value.slice(0, idx);
    const path = value.slice(idx + 2);
    if (bucket && path) return { bucket, path };
  }

  // Legacy public Supabase URL → extract bucket + path
  const marker = "/storage/v1/object/public/";
  const publicIdx = value.indexOf(marker);
  if (publicIdx >= 0) {
    const rest = value.slice(publicIdx + marker.length);
    const slash = rest.indexOf("/");
    if (slash > 0) {
      return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1).split("?")[0]) };
    }
  }

  const signedMarker = "/storage/v1/object/sign/";
  const signIdx = value.indexOf(signedMarker);
  if (signIdx >= 0) {
    const rest = value.slice(signIdx + signedMarker.length);
    const slash = rest.indexOf("/");
    if (slash > 0) {
      return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1).split("?")[0]) };
    }
  }

  if (fallbackBucket && !value.startsWith("http")) {
    return { bucket: fallbackBucket, path: value };
  }

  return null;
}

/**
 * Resolve a stored ref / legacy path / public URL into a usable browser URL.
 * Private buckets → short-lived signed URL. Public → public URL.
 */
export async function resolveStorageUrl(
  value: string | null | undefined,
  fallbackBucket?: StorageBucket,
  expiresIn = 3600
): Promise<string> {
  if (!value) return "";
  if (value.startsWith("data:")) return ""; // refuse in-memory blobs as persistence
  if (value.startsWith("http://") || value.startsWith("https://")) {
    // If it's already a URL, try to refresh signed links via parse; else return as-is
    const parsed = parseStorageRef(value, fallbackBucket);
    if (!parsed) return value;
    if (PUBLIC_BUCKETS.has(parsed.bucket)) {
      const { data } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
      return data.publicUrl;
    }
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresIn);
    return error || !data?.signedUrl ? value : data.signedUrl;
  }

  const parsed = parseStorageRef(value, fallbackBucket);
  if (!parsed) return "";

  if (PUBLIC_BUCKETS.has(parsed.bucket)) {
    const { data } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("Failed to resolve storage URL:", error?.message || "no signed URL");
    return "";
  }
  return data.signedUrl;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function bucketForEmployeeCategory(category: string): StorageBucket {
  const key = category.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  if (key === "photo_doc" || key === "photo" || key === "employee_signature") {
    return STORAGE_BUCKETS.employeePhotos;
  }
  if (KYC_SLOTS.has(key) || key.includes("aadhaar") || key.includes("pan") || key.includes("passbook")) {
    return STORAGE_BUCKETS.employeeKyc;
  }
  return STORAGE_BUCKETS.employeeDocuments;
}

async function uploadToBucket(
  bucket: StorageBucket,
  path: string,
  body: Blob | File,
  contentType: string
): Promise<StorageUploadResult> {
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed (${bucket}): ${error.message}`);
  }

  let url = "";
  if (PUBLIC_BUCKETS.has(bucket)) {
    url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } else {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    url = data?.signedUrl || "";
  }

  return {
    bucket,
    path,
    ref: encodeStorageRef(bucket, path),
    url,
    sizeBytes: body.size,
    fileSizeFormatted: formatBytes(body.size),
  };
}

/** Upload generated payslip PDF → private `payslips` bucket. */
export async function uploadPayslipPDF(
  pdfBlob: Blob,
  year: number | string,
  month: number | string,
  employeeCode: string,
  payslipNumber: string
): Promise<StorageUploadResult> {
  const formattedMonth = String(month).padStart(2, "0");
  const path = `${year}/${formattedMonth}/${sanitizeSegment(employeeCode)}/${sanitizeSegment(payslipNumber)}.pdf`;
  return uploadToBucket(STORAGE_BUCKETS.payslips, path, pdfBlob, "application/pdf");
}

export async function getPayslipPDFUrl(storagePath: string): Promise<string> {
  return resolveStorageUrl(storagePath, STORAGE_BUCKETS.payslips, 7200);
}

export async function deletePayslipPDF(storagePath: string): Promise<void> {
  const parsed = parseStorageRef(storagePath, STORAGE_BUCKETS.payslips);
  if (!parsed) return;
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) console.warn("Payslip storage deletion warning:", error.message);
}

/** Upload company logo or authorized signature → public `company-assets`. */
export async function uploadCompanyAsset(
  file: File,
  type: "logo" | "signature"
): Promise<StorageUploadResult> {
  const allowedMimes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowedMimes.includes(file.type)) {
    throw new Error("Invalid image format. Supported formats: PNG, JPEG, WebP, SVG.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Asset file size must be under 5MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${type}/${type}_${Date.now()}.${ext}`;
  return uploadToBucket(STORAGE_BUCKETS.companyAssets, path, file, file.type);
}

/** Upload employee passport photo → private `employee-photos`. */
export async function uploadEmployeePhoto(
  file: File,
  employeeCode: string
): Promise<StorageUploadResult> {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Photograph must be PNG, JPEG, or WebP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Photograph must be under 5MB.");
  }
  if (!employeeCode?.trim()) {
    throw new Error("Employee code is required before uploading a photograph.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${sanitizeSegment(employeeCode)}/photo_${Date.now()}.${ext}`;
  return uploadToBucket(STORAGE_BUCKETS.employeePhotos, path, file, file.type);
}

/**
 * Upload employee KYC / HR document to the correct private bucket.
 * KYC slots → employee-kyc; photos → employee-photos; else → employee-documents.
 */
export async function uploadEmployeeDocument(
  file: File,
  employeeCode: string,
  category: string
): Promise<StorageUploadResult> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("File size must be under 15MB.");
  }
  if (!employeeCode?.trim()) {
    throw new Error("Employee code is required before uploading documents.");
  }

  const bucket = bucketForEmployeeCategory(category);
  const maxForPhotos = 5 * 1024 * 1024;
  if (bucket === STORAGE_BUCKETS.employeePhotos && file.size > maxForPhotos) {
    throw new Error("Photograph must be under 5MB.");
  }

  const sanitizedCategory = sanitizeSegment(category).toLowerCase();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${sanitizeSegment(employeeCode)}/${sanitizedCategory}_${Date.now()}_${safeFilename}`;

  return uploadToBucket(bucket, path, file, file.type || "application/octet-stream");
}

export async function deleteEmployeeDocument(storagePath: string): Promise<void> {
  const parsed =
    parseStorageRef(storagePath, STORAGE_BUCKETS.employeeDocuments) ||
    parseStorageRef(storagePath, STORAGE_BUCKETS.employeeKyc) ||
    parseStorageRef(storagePath, STORAGE_BUCKETS.employeePhotos);
  if (!parsed) return;
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) console.warn("Document storage removal warning:", error.message);
}

/** Upload payslip-embedded image (logo / signatures) into the right bucket. */
export async function uploadPayslipImage(
  file: File,
  field: "company_logo" | "employee_signature" | "authorized_signature",
  employeeCode?: string
): Promise<StorageUploadResult> {
  if (field === "company_logo" || field === "authorized_signature") {
    return uploadCompanyAsset(file, field === "company_logo" ? "logo" : "signature");
  }
  if (!employeeCode?.trim()) {
    throw new Error("Employee code is required to store an employee signature.");
  }
  return uploadEmployeeDocument(file, employeeCode, "employee_signature");
}
