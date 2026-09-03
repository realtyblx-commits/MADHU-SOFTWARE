import { supabase } from "@/integrations/supabase/client";

/**
 * Storage Buckets:
 * - company-assets (public)
 * - payslips (private)
 * - employee-documents (private)
 */

export interface StorageUploadResult {
  path: string;
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

/**
 * Upload generated payslip PDF to 'payslips' bucket.
 * Path format: {year}/{month}/{employeeCode}/{payslipNumber}.pdf
 */
export async function uploadPayslipPDF(
  pdfBlob: Blob,
  year: number | string,
  month: number | string,
  employeeCode: string,
  payslipNumber: string
): Promise<StorageUploadResult> {
  const formattedMonth = String(month).padStart(2, "0");
  const sanitizedCode = employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedNumber = payslipNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${year}/${formattedMonth}/${sanitizedCode}/${sanitizedNumber}.pdf`;

  const { error } = await supabase.storage
    .from("payslips")
    .upload(path, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Failed to upload payslip PDF to storage:", error);
    throw new Error(`Failed to upload payslip PDF: ${error.message}`);
  }

  // Get signed URL valid for 2 hours (or public URL if bucket is public)
  const { data: signedData, error: signError } = await supabase.storage
    .from("payslips")
    .createSignedUrl(path, 7200);

  const url = signedData?.signedUrl || "";

  return {
    path,
    url,
    sizeBytes: pdfBlob.size,
    fileSizeFormatted: formatBytes(pdfBlob.size),
  };
}

/**
 * Retrieve a fresh download/view URL for a stored payslip PDF.
 */
export async function getPayslipPDFUrl(storagePath: string): Promise<string> {
  if (!storagePath) return "";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }

  const { data, error } = await supabase.storage
    .from("payslips")
    .createSignedUrl(storagePath, 7200);

  if (error || !data?.signedUrl) {
    const { data: publicData } = supabase.storage
      .from("payslips")
      .getPublicUrl(storagePath);
    return publicData.publicUrl;
  }

  return data.signedUrl;
}

/**
 * Delete a payslip PDF from 'payslips' bucket.
 */
export async function deletePayslipPDF(storagePath: string): Promise<void> {
  if (!storagePath || storagePath.startsWith("data:")) return;

  const { error } = await supabase.storage
    .from("payslips")
    .remove([storagePath]);

  if (error) {
    console.warn("Storage deletion warning (file may not exist):", error.message);
  }
}

/**
 * Upload company logo or authorized signature to 'company-assets' bucket.
 */
export async function uploadCompanyAsset(
  file: File,
  type: "logo" | "signature"
): Promise<string> {
  const allowedMimes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowedMimes.includes(file.type)) {
    throw new Error("Invalid image format. Supported formats: PNG, JPEG, WebP, SVG.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Asset file size must be under 5MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${type}/${type}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload ${type}: ${error.message}`);
  }

  const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload employee KYC or custom document to 'employee-documents' bucket.
 */
export async function uploadEmployeeDocument(
  file: File,
  employeeCode: string,
  category: string
): Promise<StorageUploadResult> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("File size must be under 15MB.");
  }

  const sanitizedCode = employeeCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedCategory = category.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${sanitizedCode}/${sanitizedCategory}_${Date.now()}_${safeFilename}`;

  const { error } = await supabase.storage
    .from("employee-documents")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  const { data: signedData } = await supabase.storage
    .from("employee-documents")
    .createSignedUrl(path, 86400); // 24-hour signed link

  const url = signedData?.signedUrl || "";

  return {
    path,
    url,
    sizeBytes: file.size,
    fileSizeFormatted: formatBytes(file.size),
  };
}

/**
 * Delete employee document from 'employee-documents' bucket.
 */
export async function deleteEmployeeDocument(storagePath: string): Promise<void> {
  if (!storagePath || storagePath.startsWith("data:")) return;

  const { error } = await supabase.storage
    .from("employee-documents")
    .remove([storagePath]);

  if (error) {
    console.warn("Document storage removal warning:", error.message);
  }
}
