import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Building2, Clock, IndianRupee, FileText, CheckCircle2, Sun, Trash2, AlertTriangle, Download, Database, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { jsonStore } from "@/lib/json-store";
import { logAuditEvent } from "@/lib/audit";
import { generateFullDatabaseBackup, downloadFile, convertToCSV } from "@/lib/backup";
import { PageHeader } from "@/components/layout/AppShell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSettings } from "@/lib/queries";
import { uploadCompanyAsset } from "@/lib/storage";
import type { CompanySettings } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput12 } from "@/components/ui/time-input-12";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [form, setForm] = useState<Partial<CompanySettings>>({
    company_name: "BLX REALTY PRIVATE LIMITED",
    website: "www.theblxrealty.com",
    logo_url: "/apple-touch-icon.png",
    office_timing: "10:30 AM - 6:30 PM",
    office_start: "10:30",
    office_end: "18:30",
    late_threshold: "10:45 AM",
    default_payment_mode: "Bank Transfer",
    default_currency: "₹",
    payslip_prefix: "PS-",
    employee_id_prefix: "BLX26-",
    authorized_signatory: "Authorized Signatory (BLX Realty Pvt Ltd)",
    payslip_footer: "This is a computer-generated salary slip and does not require a physical signature.",
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleImageUpload = async (field: "logo_url" | "authorized_signature", file: File | null) => {
    if (!file) return;
    try {
      toast.info("Uploading asset to Supabase Storage...");
      const publicUrl = await uploadCompanyAsset(file, field === "logo_url" ? "logo" : "signature");
      setForm((prev) => ({ ...prev, [field]: publicUrl }));
      toast.success("Asset uploaded to Supabase Storage");
    } catch (err: any) {
      console.warn("Storage upload error, using local preview:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const id = form.id || "settings-default";
      const payload = {
        ...form,
        id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("company_settings").upsert(payload as never);
      if (error) throw error;

      await logAuditEvent({
        action: "SETTINGS_UPDATE",
        entity_type: "settings",
        entity_id: id,
        description: `Updated company settings & office timing (${form.office_timing || "10:30 AM - 6:30 PM"})`,
        details: {
          company_name: form.company_name,
          office_timing: form.office_timing,
          authorized_signatory: form.authorized_signatory,
        },
      });

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved successfully.");
    },
    onError: (e: Error) => toast.error("Failed to save settings: " + e.message),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <PageHeader
        title="Company Settings"
        description="Configure corporate profile, official branding, default work timings, and payslip numbering."
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="font-semibold">
            Save Settings
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Profile & Logo */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Building2 className="size-5" />
              <CardTitle className="text-base">Company Profile & Branding</CardTitle>
            </div>
            <CardDescription>Official corporate details for salary slip headers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={form.company_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>

            <div>
              <Label>Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-16 w-36 rounded-md border bg-muted/30 p-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={form.logo_url || "/apple-touch-icon.png"}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="company-logo-upload" className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    <Upload className="size-3.5" /> Upload Logo
                    <input
                      id="company-logo-upload"
                      name="company-logo-upload"
                      aria-label="Upload Company Logo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload("logo_url", e.target.files?.[0] || null)}
                    />
                  </label>
                  {form.logo_url !== "/apple-touch-icon.png" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, logo_url: "/apple-touch-icon.png" }))}
                      className="text-xs text-muted-foreground block h-7"
                    >
                      Reset to Default Logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="payslip_footer">Payslip Legal Disclaimer</Label>
              <Textarea
                id="payslip_footer"
                rows={2}
                value={form.payslip_footer ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, payslip_footer: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Office Timings & Attendance Defaults */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Clock className="size-5" />
              <CardTitle className="text-base">Office Timings & Attendance Rules</CardTitle>
            </div>
            <CardDescription>Shift parameters for late arrival and absent calculations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="office_timing">Office Timing Label</Label>
              <Input
                id="office_timing"
                value={form.office_timing ?? "10:30 AM - 6:30 PM"}
                onChange={(e) => setForm((f) => ({ ...f, office_timing: e.target.value }))}
                placeholder="10:30 AM - 6:30 PM"
              />
            </div>

            <div>
              <Label htmlFor="late_threshold">Late Arrival Threshold</Label>
              <Input
                id="late_threshold"
                value={form.late_threshold ?? "10:45 AM"}
                onChange={(e) => setForm((f) => ({ ...f, late_threshold: e.target.value }))}
                placeholder="10:45 AM"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="office_start" className="mb-1.5 block">Start Time</Label>
                <TimeInput12
                  id="office_start"
                  defaultPeriod="AM"
                  placeholder="10:30"
                  value={form.office_start ?? "10:30"}
                  onChange={(val) => setForm((f) => ({ ...f, office_start: val }))}
                />
              </div>
              <div>
                <Label htmlFor="office_end" className="mb-1.5 block">End Time</Label>
                <TimeInput12
                  id="office_end"
                  defaultPeriod="PM"
                  placeholder="06:30"
                  value={form.office_end ?? "18:30"}
                  onChange={(val) => setForm((f) => ({ ...f, office_end: val }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="default_payment_mode">Default Payment Mode</Label>
              <Input
                id="default_payment_mode"
                value={form.default_payment_mode ?? "Bank Transfer"}
                onChange={(e) => setForm((f) => ({ ...f, default_payment_mode: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Prefixes & Numbering */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <FileText className="size-5" />
              <CardTitle className="text-base">ID Prefixes & Formatting</CardTitle>
            </div>
            <CardDescription>Auto-generated prefixes for payslips and employees.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="payslip_prefix">Payslip No. Prefix</Label>
                <Input
                  id="payslip_prefix"
                  value={form.payslip_prefix ?? "PS-"}
                  onChange={(e) => setForm((f) => ({ ...f, payslip_prefix: e.target.value }))}
                  placeholder="PS-"
                />
              </div>
              <div>
                <Label htmlFor="employee_id_prefix">Employee ID Prefix</Label>
                <Input
                  id="employee_id_prefix"
                  value={form.employee_id_prefix ?? "BLX26-"}
                  onChange={(e) => setForm((f) => ({ ...f, employee_id_prefix: e.target.value }))}
                  placeholder="BLX26-"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="default_currency">Currency Symbol</Label>
              <Input
                id="default_currency"
                value={form.default_currency ?? "₹"}
                onChange={(e) => setForm((f) => ({ ...f, default_currency: e.target.value }))}
                placeholder="₹"
              />
            </div>
          </CardContent>
        </Card>

        {/* Authorized Signatory */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="size-5" />
              <CardTitle className="text-base">Authorized Signatory</CardTitle>
            </div>
            <CardDescription>Default signatory label and signature stamp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="authorized_signatory">Signatory Label</Label>
              <Input
                id="authorized_signatory"
                value={form.authorized_signatory ?? "Authorized Signatory (BLX Realty Pvt Ltd)"}
                onChange={(e) => setForm((f) => ({ ...f, authorized_signatory: e.target.value }))}
              />
            </div>

            <div>
              <Label>Default Signature Image</Label>
              <div className="mt-2 flex items-center gap-4">
                {form.authorized_signature ? (
                  <div className="h-14 w-36 rounded-md border bg-muted/20 p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={form.authorized_signature}
                      alt="Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No default signature uploaded.</span>
                )}
                <label htmlFor="company-signature-upload" className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  <Upload className="size-3.5" /> Upload Signature
                  <input
                    id="company-signature-upload"
                    name="company-signature-upload"
                    aria-label="Upload Default Signature Image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleImageUpload("authorized_signature", e.target.files?.[0] || null)
                    }
                  />
                </label>
                {form.authorized_signature && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, authorized_signature: null }))}
                    className="text-xs text-destructive h-7"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance & Theme Mode */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Sun className="size-5" />
              <CardTitle className="text-base">Appearance & Theme Mode</CardTitle>
            </div>
            <CardDescription>
              Select your preferred visual style across all screens, charts, and data registers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Color Theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle between corporate light mode, sleek dark mode, or follow your operating system.
              </p>
            </div>
            <ThemeToggle variant="segmented" />
          </CardContent>
        </Card>

        {/* Disaster Recovery & Cloud Backup (Free Plan Resilience) */}
        <Card className="shadow-sm lg:col-span-2 border-primary/20 bg-primary/[0.01]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <ShieldCheck className="size-5" />
              <CardTitle className="text-base">Database Backup & Disaster Recovery</CardTitle>
            </div>
            <CardDescription>
              Export full database snapshots and CSV registers. Essential for low-frequency usage and Free-tier data safety.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg border border-border/60 bg-card">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Database className="size-4 text-primary" /> Full Payroll Database Snapshot (JSON)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete snapshot of all tables (Employees, Attendance, Payroll, Payslips metadata, Audit Logs, and Settings).
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    toast.info("Generating complete database backup...");
                    const backup = await generateFullDatabaseBackup();
                    const dateStr = new Date().toISOString().split("T")[0];
                    downloadFile(
                      JSON.stringify(backup, null, 2),
                      `blx_payroll_backup_${dateStr}.json`,
                      "application/json"
                    );
                    toast.success("Full database backup downloaded successfully.");
                  } catch (err: any) {
                    toast.error("Failed to generate backup: " + err.message);
                  }
                }}
                className="gap-1.5 font-medium"
              >
                <Download className="size-4" /> Download JSON Backup
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card">
                <div>
                  <p className="text-sm font-medium">Employee Roster (CSV)</p>
                  <p className="text-xs text-muted-foreground">Staff profiles, designations, banks</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const { data } = await supabase.from("employees").select("*");
                    if (!data || data.length === 0) {
                      toast.info("No employee records to export.");
                      return;
                    }
                    const csv = convertToCSV(data);
                    downloadFile(csv, `employees_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
                    toast.success("Employees CSV exported.");
                  }}
                  className="text-xs h-8 gap-1"
                >
                  <Download className="size-3.5" /> CSV
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card">
                <div>
                  <p className="text-sm font-medium">Payslip History (CSV)</p>
                  <p className="text-xs text-muted-foreground">Historical salary slips & amounts</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const { data } = await supabase.from("payslips").select("*");
                    if (!data || data.length === 0) {
                      toast.info("No payslip records to export.");
                      return;
                    }
                    const csv = convertToCSV(data);
                    downloadFile(csv, `payslips_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
                    toast.success("Payslips CSV exported.");
                  }}
                  className="text-xs h-8 gap-1"
                >
                  <Download className="size-3.5" /> CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database & Data Management */}
        <Card className="shadow-sm lg:col-span-2 border-destructive/30 bg-destructive/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertTriangle className="size-5" />
              <CardTitle className="text-base text-destructive">Data Management & Reset</CardTitle>
            </div>
            <CardDescription>
              Clear all employees, attendance logs, generated payslips, and payroll records to start completely fresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Purge All Operational Data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently wipes all employees, documents, attendance records, and payslips from local storage.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete ALL data? This will remove all employees, attendance, and payslips.")) {
                  jsonStore.clearAllOperationalData();
                  qc.invalidateQueries();
                  await logAuditEvent({
                    action: "DELETE_ALL_DATA",
                    entity_type: "database",
                    entity_id: "all",
                    description: "All employee, attendance, document, and payslip data cleared by Admin.",
                  });
                  toast.success("All data has been deleted. System is in fresh state.");
                }
              }}
              className="font-semibold gap-1.5"
            >
              <Trash2 className="size-4" /> Clear All Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg" className="font-semibold px-8">
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
