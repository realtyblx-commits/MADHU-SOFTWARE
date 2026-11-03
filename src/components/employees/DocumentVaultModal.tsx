import React, { useState } from "react";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  CreditCard,
  Building2,
  User,
  Plus,
  FolderPlus,
  Paperclip,
  Calendar,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { Employee, EmployeeDocument } from "@/lib/payroll";
import { uploadEmployeeDocument, deleteEmployeeDocument } from "@/lib/storage";
import { StorageImg, openStoragePreview } from "@/components/storage/StorageMedia";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentVaultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onUpdated?: () => void;
  uploadedBy?: "admin" | "employee";
}

interface DocSlot {
  key: "aadhaar_card_doc" | "pan_card_doc" | "bank_passbook_doc" | "photo_doc";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  acceptedTypes: string;
  color: string;
}

const DOC_SLOTS: DocSlot[] = [
  {
    key: "aadhaar_card_doc",
    title: "Aadhaar Card (Photo / PDF)",
    description: "Official 12-digit Indian national identity card proof (Front & Back).",
    icon: ShieldCheck,
    acceptedTypes: "image/*,application/pdf",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  {
    key: "pan_card_doc",
    title: "PAN Card (Photo / PDF)",
    description: "Permanent Account Number card issued by the Income Tax Department.",
    icon: CreditCard,
    acceptedTypes: "image/*,application/pdf",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  },
  {
    key: "bank_passbook_doc",
    title: "Bank Passbook / Cancelled Cheque",
    description: "Proof of bank account number and IFSC code for salary disbursement.",
    icon: Building2,
    acceptedTypes: "image/*,application/pdf",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    key: "photo_doc",
    title: "Passport Size Photograph",
    description: "Recent formal passport photograph for official employment records.",
    icon: User,
    acceptedTypes: "image/*",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
];

function getFileTypeMeta(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) {
    return {
      label: "PDF",
      badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/30",
      iconColor: "text-rose-500",
    };
  }
  if (["doc", "docx", "odt", "rtf", "txt"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      iconColor: "text-blue-500",
    };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      iconColor: "text-emerald-500",
    };
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return {
      label: "IMAGE",
      badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/30",
      iconColor: "text-amber-500",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      label: "ZIP",
      badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
      iconColor: "text-indigo-500",
    };
  }
  return {
    label: ext ? ext.toUpperCase() : "FILE",
    badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    iconColor: "text-slate-400",
  };
}

export function DocumentVaultModal({
  open,
  onOpenChange,
  employee,
  onUpdated,
  uploadedBy = "admin",
}: DocumentVaultModalProps) {
  const [activePreview, setActivePreview] = useState<{ url: string; title: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // State for adding arbitrary additional files
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [customDocName, setCustomDocName] = useState("");
  const [customDocCategory, setCustomDocCategory] = useState("Other Document");
  const [selectedCustomFile, setSelectedCustomFile] = useState<File | null>(null);

  if (!employee) return null;

  const additionalDocs: EmployeeDocument[] = Array.isArray(employee.documents)
    ? employee.documents
    : [];

  const handleUploadAdditionalFile = async () => {
    if (!selectedCustomFile || !employee) {
      toast.error("Please select a file to upload");
      return;
    }
    if (selectedCustomFile.size > 15 * 1024 * 1024) {
      toast.error("File size must be under 15MB");
      return;
    }

    try {
      setIsSaving(true);
      toast.info("Uploading document to Supabase Storage...");
      const uploadRes = await uploadEmployeeDocument(
        selectedCustomFile,
        employee.employee_code,
        customDocCategory
      );

      const newDoc: EmployeeDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: customDocName.trim() || selectedCustomFile.name,
        category: customDocCategory as any,
        file_url: uploadRes.ref,
        storage_bucket: uploadRes.bucket,
        storage_path: uploadRes.path,
        file_name: selectedCustomFile.name,
        file_size:
          selectedCustomFile.size < 1024 * 1024
            ? `${(selectedCustomFile.size / 1024).toFixed(1)} KB`
            : `${(selectedCustomFile.size / (1024 * 1024)).toFixed(2)} MB`,
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString(),
      };

      const existingDocs = Array.isArray(employee.documents) ? employee.documents : [];
      const updatedPayload = {
        ...employee,
        documents: [...existingDocs, newDoc],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("employees").upsert(updatedPayload as never);
      if (error) throw error;

      await logAuditEvent({
        action: "DOCUMENT_UPLOAD",
        entity_type: "employee",
        entity_id: employee.employee_code || employee.id,
        user_email: employee.email || undefined,
        description: `Uploaded additional document "${newDoc.name}" (${selectedCustomFile.name}) for ${employee.full_name} by ${uploadedBy}`,
        details: {
          document_id: newDoc.id,
          document_name: newDoc.name,
          file_name: selectedCustomFile.name,
          file_size: newDoc.file_size,
          category: newDoc.category,
          uploaded_by: uploadedBy,
        },
      });

      toast.success(`Uploaded "${newDoc.name}" to Supabase Storage.`);
      setIsAddFileOpen(false);
      setSelectedCustomFile(null);
      setCustomDocName("");
      setCustomDocCategory("Other Document");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error("Failed to upload document: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAdditionalDoc = async (docId: string, docName: string) => {
    if (!employee) return;
    try {
      setIsSaving(true);
      const existingDocs = Array.isArray(employee.documents) ? employee.documents : [];
      const docToDelete = existingDocs.find((d) => d.id === docId);
      if (docToDelete?.file_url) {
        try {
          await deleteEmployeeDocument(docToDelete.file_url);
        } catch {}
      }
      const updatedDocs = existingDocs.filter((d) => d.id !== docId);

      const updatedPayload = {
        ...employee,
        documents: updatedDocs,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("employees").upsert(updatedPayload as never);
      if (error) throw error;

      await logAuditEvent({
        action: "DOCUMENT_DELETE",
        entity_type: "employee",
        entity_id: employee.employee_code || employee.id,
        user_email: employee.email || undefined,
        description: `Removed additional document "${docName}" for ${employee.full_name} by ${uploadedBy}`,
      });

      toast.success(`Removed "${docName}".`);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error("Failed to remove document: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (slotKey: DocSlot["key"], file: File | null) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size must be under 15MB");
      return;
    }

    try {
      setIsSaving(true);
      toast.info("Uploading KYC document to Supabase Storage...");
      const uploadRes = await uploadEmployeeDocument(file, employee.employee_code, slotKey);

      const updatedPayload = {
        ...employee,
        [slotKey]: uploadRes.ref,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("employees").upsert(updatedPayload as never);
      if (error) throw error;

      await logAuditEvent({
        action: "DOCUMENT_UPLOAD",
        entity_type: "employee",
        entity_id: employee.employee_code || employee.id,
        user_email: employee.email || undefined,
        description: `Uploaded ${slotKey.replace(/_/g, " ")} for ${employee.full_name} by ${uploadedBy}`,
        details: {
          employee_name: employee.full_name,
          document_type: slotKey,
          file_name: file.name,
          file_size: `${(file.size / 1024).toFixed(1)} KB`,
          uploaded_by: uploadedBy,
        },
      });

      toast.success(`Uploaded ${file.name} to Supabase Storage.`);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error("Failed to upload document: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDoc = async (slotKey: DocSlot["key"]) => {
    try {
      setIsSaving(true);
      const updatedPayload = {
        ...employee,
        [slotKey]: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("employees").upsert(updatedPayload as never);
      if (error) throw error;

      await logAuditEvent({
        action: "DOCUMENT_DELETE",
        entity_type: "employee",
        entity_id: employee.employee_code || employee.id,
        description: `Removed ${slotKey.replace(/_/g, " ")} for ${employee.full_name} by ${uploadedBy}`,
      });

      toast.success("Document removed.");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error("Failed to remove document: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const completedCount = DOC_SLOTS.filter((s) => Boolean((employee as any)[s.key])).length;
  const kycPercent = Math.round((completedCount / DOC_SLOTS.length) * 100);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <ShieldCheck className="size-5 text-blue-500" />
                  <span>KYC & Document Vault — {employee.full_name}</span>
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Employee Code: <span className="font-mono font-bold text-foreground">{employee.employee_code}</span> · {employee.designation || "Staff"} · {employee.email}
                </DialogDescription>
              </div>
              <Badge
                variant={kycPercent === 100 ? "default" : "outline"}
                className={
                  kycPercent === 100
                    ? "bg-emerald-600 text-white font-semibold px-3 py-1"
                    : "border-amber-500 text-amber-500 font-semibold px-3 py-1"
                }
              >
                {kycPercent === 100 ? "KYC Complete (100%)" : `KYC Pending (${completedCount}/${DOC_SLOTS.length})`}
              </Badge>
            </div>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden my-2 border border-border/50">
            <div
              className={`h-full transition-all duration-300 ${
                kycPercent === 100 ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${kycPercent}%` }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            {DOC_SLOTS.map((slot) => {
              const fileData = (employee as any)[slot.key] as string | undefined | null;
              const isUploaded = Boolean(fileData);
              const isPdf =
                Boolean(fileData?.startsWith("data:application/pdf")) ||
                Boolean(fileData?.toLowerCase().includes(".pdf"));
              const Icon = slot.icon;

              return (
                <Card
                  key={slot.key}
                  className={`border transition-all duration-200 ${
                    isUploaded
                      ? "border-emerald-500/40 bg-emerald-500/[0.02]"
                      : "border-border/80 bg-card hover:border-border"
                  }`}
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-xl border ${slot.color}`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{slot.title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5 line-clamp-1">
                          {slot.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2">
                    {isUploaded && fileData ? (
                      <div className="space-y-3">
                        {/* Preview Box */}
                        <div className="relative group overflow-hidden rounded-lg border border-border/70 bg-muted/40 h-32 flex items-center justify-center">
                          {isPdf ? (
                            <div className="flex flex-col items-center justify-center p-3 text-center">
                              <FileText className="size-10 text-rose-500 mb-1" />
                              <span className="text-xs font-semibold">PDF Document</span>
                              <span className="text-[10px] text-muted-foreground">Ready to view / download</span>
                            </div>
                          ) : (
                            <StorageImg
                              value={fileData}
                              alt={slot.title}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}

                          {/* Hover action overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 px-2.5 text-xs font-medium"
                              onClick={async () => {
                                const url = await openStoragePreview(fileData);
                                if (!url) {
                                  toast.error("Could not resolve document from Supabase Storage");
                                  return;
                                }
                                setActivePreview({ url, title: slot.title });
                              }}
                            >
                              <Eye className="size-3.5 mr-1" /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 px-2.5 text-xs font-medium"
                              onClick={async () => {
                                const url = await openStoragePreview(fileData);
                                if (!url) {
                                  toast.error("Could not resolve document from Supabase Storage");
                                  return;
                                }
                                handleDownload(url, `${employee.employee_code}_${slot.key}`);
                              }}
                            >
                              <Download className="size-3.5 mr-1" /> Download
                            </Button>
                          </div>
                        </div>

                        {/* Status + Actions Row */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                            <CheckCircle2 className="size-4" />
                            <span>Document Verified & Saved</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <label className="cursor-pointer">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-input bg-background hover:bg-accent font-medium">
                                <Upload className="size-3" /> Replace
                              </span>
                              <input
                                type="file"
                                accept={slot.acceptedTypes}
                                className="hidden"
                                disabled={isSaving}
                                onChange={(e) => handleFileUpload(slot.key, e.target.files?.[0] || null)}
                              />
                            </label>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              disabled={isSaving}
                              onClick={() => handleRemoveDoc(slot.key)}
                              title="Remove document"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/80 rounded-lg text-center bg-muted/10 hover:bg-muted/20 transition-colors">
                        <Upload className="size-7 text-muted-foreground/60 mb-2" />
                        <p className="text-xs font-medium text-foreground">No document uploaded yet</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 mb-3">
                          Upload Aadhaar / PAN photo or scanned PDF (Max 8MB)
                        </p>

                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-95 transition-opacity">
                            <Upload className="size-3.5" /> Upload {slot.title.split(" ")[0]}
                          </span>
                          <input
                            type="file"
                            accept={slot.acceptedTypes}
                            className="hidden"
                            disabled={isSaving}
                            onChange={(e) => handleFileUpload(slot.key, e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Section 2: Additional Employee Documents & Files (Any Format) */}
          <div className="pt-6 mt-4 border-t border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderPlus className="size-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Additional Documents & Files (Any Format)
                  </h3>
                  <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5">
                    {additionalDocs.length} {additionalDocs.length === 1 ? "file" : "files"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Attach offer letters, academic credentials, contracts, resumes, spreadsheets, or any other file format (Max 15MB).
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddFileOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <Plus className="size-4" /> Add File
              </Button>
            </div>

            {additionalDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 flex flex-col items-center justify-center text-center">
                <div className="size-10 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground mb-2">
                  <FileText className="size-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">No additional documents uploaded yet</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                  You can attach any supporting files for this employee such as offer letters, educational certificates, agreements, NDAs, or spreadsheets.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={() => setIsAddFileOpen(true)}
                >
                  <Plus className="size-3.5" /> Upload First File
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {additionalDocs.map((doc) => {
                  const meta = getFileTypeMeta(doc.file_name);
                  const isPdf =
                    doc.file_name.toLowerCase().endsWith(".pdf") ||
                    doc.file_url.toLowerCase().includes(".pdf") ||
                    doc.file_url.startsWith("data:application/pdf");
                  const isImage =
                    doc.file_url.startsWith("data:image/") ||
                    ["png", "jpg", "jpeg", "webp"].some((ext) =>
                      doc.file_name.toLowerCase().endsWith(ext) ||
                      doc.file_url.toLowerCase().includes(`.${ext}`)
                    );

                  return (
                    <Card
                      key={doc.id}
                      className="border border-border/80 bg-card hover:border-border transition-colors"
                    >
                      <CardContent className="p-3.5 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`flex size-10 items-center justify-center rounded-xl border shrink-0 ${meta.badgeColor}`}
                          >
                            {isImage ? (
                              <ImageIcon className="size-5" />
                            ) : (
                              <FileText className="size-5" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-bold text-foreground truncate" title={doc.name}>
                              {doc.name}
                            </p>
                            <p
                              className="text-[11px] text-muted-foreground truncate"
                              title={doc.file_name}
                            >
                              {doc.file_name} {doc.file_size ? `· ${doc.file_size}` : ""}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {doc.category || "Document"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground/80">
                                {doc.uploaded_by === "employee" ? "By Employee" : "By Admin"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          {(isPdf || isImage) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Preview document"
                              onClick={async () => {
                                const url = await openStoragePreview(doc.file_url);
                                if (!url) {
                                  toast.error("Could not resolve document from Supabase Storage");
                                  return;
                                }
                                setActivePreview({ url, title: doc.name });
                              }}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Download document"
                            onClick={async () => {
                              const url = await openStoragePreview(doc.file_url);
                              if (!url) {
                                toast.error("Could not resolve document from Supabase Storage");
                                return;
                              }
                              handleDownload(url, doc.file_name);
                            }}
                          >
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="Remove document"
                            disabled={isSaving}
                            onClick={() => handleRemoveAdditionalDoc(doc.id, doc.name)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Additional File Modal */}
      <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-primary" />
              <span>Upload Additional Document</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Attach any supplementary file for {employee.full_name} (PDF, Word, Excel, Images, etc. max 15MB).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label htmlFor="custom-doc-name" className="text-xs font-semibold">
                Document Title / Name
              </Label>
              <Input
                id="custom-doc-name"
                value={customDocName}
                onChange={(e) => setCustomDocName(e.target.value)}
                placeholder="e.g. Offer Letter, Degree Certificate, NDA"
                className="mt-1 text-xs h-9"
              />
            </div>

            <div>
              <Label htmlFor="custom-doc-category" className="text-xs font-semibold">
                Category
              </Label>
              <Select value={customDocCategory} onValueChange={setCustomDocCategory}>
                <SelectTrigger id="custom-doc-category" className="mt-1 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offer Letter">Offer Letter</SelectItem>
                  <SelectItem value="Appointment / Relieving">Appointment / Relieving Letter</SelectItem>
                  <SelectItem value="Educational Certificate">Educational Certificate</SelectItem>
                  <SelectItem value="Employment Agreement / NDA">Employment Agreement / NDA</SelectItem>
                  <SelectItem value="Resume / CV">Resume / Curriculum Vitae</SelectItem>
                  <SelectItem value="Previous Payslips / Exp">Previous Payslips / Experience</SelectItem>
                  <SelectItem value="Other Document">Other Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Select File (Any Format)</Label>
              <div className="mt-1 border-2 border-dashed border-border/80 rounded-xl p-4 text-center bg-muted/10 hover:bg-muted/20 transition-colors">
                {selectedCustomFile ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{selectedCustomFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(selectedCustomFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => setSelectedCustomFile(null)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="size-6 text-muted-foreground/60 mx-auto mb-1.5" />
                    <p className="text-xs font-medium">Click to choose a file from your computer</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">
                      PDF, DOCX, XLSX, PNG, JPG, TXT, ZIP, etc. (Max 15MB)
                    </p>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent">
                      Browse File
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setSelectedCustomFile(f);
                            if (!customDocName.trim()) {
                              const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "");
                              setCustomDocName(nameWithoutExt.replace(/[_-]/g, " "));
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddFileOpen(false);
                setSelectedCustomFile(null);
                setCustomDocName("");
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUploadAdditionalFile}
              disabled={isSaving || !selectedCustomFile}
            >
              {isSaving ? "Uploading..." : "Upload & Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Document Preview Modal */}
      {activePreview && (
        <Dialog open={Boolean(activePreview)} onOpenChange={() => setActivePreview(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4">
            <DialogHeader className="pb-2 flex flex-row items-center justify-between">
              <DialogTitle className="text-base font-bold">{activePreview.title}</DialogTitle>
              <Button
                size="sm"
                variant="outline"
                className="mr-6"
                onClick={() => handleDownload(activePreview.url, `${employee.employee_code}_doc`)}
              >
                <Download className="size-3.5 mr-1" /> Download
              </Button>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-lg border bg-muted/20 p-2 flex items-center justify-center min-h-[400px]">
              {activePreview.url.startsWith("data:application/pdf") ||
              activePreview.url.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={activePreview.url}
                  title={activePreview.title}
                  className="w-full h-[600px] border-none rounded"
                />
              ) : (
                <img
                  src={activePreview.url}
                  alt={activePreview.title}
                  className="max-h-[600px] w-auto object-contain rounded shadow"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
