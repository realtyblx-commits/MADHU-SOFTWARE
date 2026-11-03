import { useEffect, useState } from "react";
import { resolveStorageUrl, type StorageBucket } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Renders an <img> from a durable Supabase Storage ref / public URL. */
export function StorageImg({
  value,
  alt,
  className,
  fallbackBucket,
}: {
  value?: string | null;
  alt: string;
  className?: string;
  fallbackBucket?: StorageBucket;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!value) {
        if (!cancelled) setSrc("");
        return;
      }
      if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http")) {
        // Refresh signed / public URLs when possible; data: shown only for legacy rows
        if (value.startsWith("http")) {
          const resolved = await resolveStorageUrl(value, fallbackBucket);
          if (!cancelled) setSrc(resolved || value);
          return;
        }
        if (!cancelled) setSrc(value);
        return;
      }
      const resolved = await resolveStorageUrl(value, fallbackBucket);
      if (!cancelled) setSrc(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, fallbackBucket]);

  if (!src) {
    return <div className={cn("bg-muted/40", className)} aria-hidden />;
  }

  return <img src={src} alt={alt} className={className} />;
}

/** Resolve a storage ref to a temporary view/download URL. */
export async function openStoragePreview(value: string | null | undefined): Promise<string> {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  return resolveStorageUrl(value);
}
