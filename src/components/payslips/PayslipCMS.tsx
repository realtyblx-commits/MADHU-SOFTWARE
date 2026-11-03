import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Printer,
  Download,
  Eye,
  Save,
  RotateCcw,
  Calculator,
  Upload,
  Trash2,
  Building2,
  User,
  Calendar,
  IndianRupee,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import {
  PayslipRecord,
  CompanySettings,
  Employee,
  calculateDeductions,
  formatIndianCurrency,
} from "@/lib/payroll";
import { generatePayslipPDF } from "@/lib/pdf-generator";
import { uploadPayslipPDF } from "@/lib/storage";
import { PayslipDocument } from "@/components/payslips/PayslipDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface PayslipCMSProps {
  initialData?: PayslipRecord;
  isEditing?: boolean;
}

const isUuid = (str?: string | null) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ""));


export function PayslipCMS({ initialData, isEditing = false }: PayslipCMSProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdmin, isManager } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (isEditing && !isSuperAdmin) {
      toast.error("Only Super Admin can edit existing payslips.");
      navigate({ to: "/payslips" });
      return;
    }
    if (!isEditing && !isManager) {
      toast.error("You do not have permission to create payslips.");
      navigate({ to: "/payslips" });
    }
  }, [isEditing, isSuperAdmin, isManager, navigate]);

  // Fetch company settings & employees
  const { data: settings } = useQuery<CompanySettings | null>({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").maybeSingle();
      return (data as CompanySettings) ?? null;
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("*").order("full_name");
      return (data as unknown as Employee[]) ?? [];
    },
  });

  // Calculate default dates (current month or 29th to 29th cycle)
  const defaultDates = React.useMemo(() => {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 29);
    const currMonth = new Date(today.getFullYear(), today.getMonth(), 29);
    return {
      start: prevMonth.toISOString().slice(0, 10),
      end: currMonth.toISOString().slice(0, 10),
    };
  }, []);

  // Form state
  const [form, setForm] = useState<PayslipRecord>(() => {
    if (initialData) return initialData;
    return {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ps-${Date.now()}`,
      payslip_number: `PS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      employee_id: "BLX26-001",
      employee_name: "",
      salary_period_start: defaultDates.start,
      salary_period_end: defaultDates.end,
      salary_period_label: "",
      payment_mode: "Bank Transfer",
      absent_days: 0,
      late_minutes: 0,
      office_timing: "10:30 AM - 6:30 PM",
      gross_salary: 30000,
      absent_deduction: 0,
      late_deduction: 0,
      total_deduction: 0,
      net_salary: 30000,
      payment_status: "Processed through Bank Transfer",
      employee_signature: null,
      authorized_signature: null,
      authorized_signatory_label: "Authorized Signatory (BLX Realty Pvt Ltd)",
      company_name: "BLX REALTY PRIVATE LIMITED",
      company_website: "www.theblxrealty.com",
      company_logo: "/apple-touch-icon.png",
      status: "Generated",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Sync settings once loaded if not editing existing
  useEffect(() => {
    if (settings && !initialData) {
      setForm((prev) => ({
        ...prev,
        company_name: settings.company_name || prev.company_name || "BLX REALTY PRIVATE LIMITED",
        company_website: settings.website || prev.company_website || "www.theblxrealty.com",
        company_logo: (settings.logo_url || prev.company_logo) ?? "/apple-touch-icon.png",
        office_timing: settings.office_timing || `${settings.office_start || "10:30"} - ${settings.office_end || "18:30"}`,
        payment_mode: settings.default_payment_mode || prev.payment_mode || "Bank Transfer",
        authorized_signatory_label:
          settings.authorized_signatory || prev.authorized_signatory_label || "Authorized Signatory (BLX Realty Pvt Ltd)",
        authorized_signature: (settings.authorized_signature ?? prev.authorized_signature) ?? null,
      }));
    }
  }, [settings, initialData]);

  // Handle Employee selection
  const handleSelectEmployee = (empId: string) => {
    const emp = employees.find((e) => (e as any).employee_id === empId || e.id === empId || e.employee_code === empId);
    if (!emp) return;

    const gross = Number(emp.gross_salary) || 30000;
    const deductions = calculateDeductions(gross, form.absent_days, form.late_minutes);

    setForm((prev) => ({
      ...prev,
      employee_id: (emp as any).employee_id || emp.employee_code || "BLX26-001",
      employee_name: emp.full_name,
      gross_salary: gross,
      payment_mode: emp.payment_mode || prev.payment_mode,
      absent_deduction: deductions.absentDeduction,
      late_deduction: deductions.lateDeduction,
      total_deduction: deductions.totalDeduction,
      net_salary: deductions.netSalary,
    }));
  };

  // Instant reactive calculation when salary or deductions change
  const handleRecalculate = (
    gross = form.gross_salary,
    absent = form.absent_days,
    late = form.late_minutes
  ) => {
    const res = calculateDeductions(gross, absent, late);
    setForm((prev) => ({
      ...prev,
      gross_salary: gross,
      absent_days: absent,
      late_minutes: late,
      absent_deduction: res.absentDeduction,
      late_deduction: res.lateDeduction,
      total_deduction: res.totalDeduction,
      net_salary: res.netSalary,
    }));
  };

  // Direct manual edit of deductions
  const handleDeductionChange = (
    field: "absent_deduction" | "late_deduction",
    val: number
  ) => {
    const absent = field === "absent_deduction" ? val : form.absent_deduction;
    const late = field === "late_deduction" ? val : form.late_deduction;
    const total = Number((absent + late).toFixed(2));
    const net = Number(Math.max(0, form.gross_salary - total).toFixed(2));

    setForm((prev) => ({
      ...prev,
      [field]: val,
      total_deduction: total,
      net_salary: net,
    }));
  };

  // Image Upload handler — always Supabase Storage (never base64 in DB)
  const handleImageUpload = async (
    field: "company_logo" | "employee_signature" | "authorized_signature",
    file: File | null
  ) => {
    if (!file) return;
    try {
      toast.info("Uploading image to Supabase Storage...");
      const { uploadPayslipImage } = await import("@/lib/storage");
      const uploaded = await uploadPayslipImage(file, field, form.employee_id || undefined);
      // Persist durable storage ref in DB; preview uses resolved URL via PayslipDocument
      setForm((prev) => ({
        ...prev,
        [field]: uploaded.ref,
      }));
      toast.success("Image saved to Supabase Storage");
    } catch (err: any) {
      toast.error(err?.message || "Image upload failed");
    }
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate
      if (!form.employee_name.trim()) throw new Error("Employee Name is required.");
      if (!form.employee_id.trim()) throw new Error("Employee ID is required.");
      if (!form.payslip_number.trim()) throw new Error("Payslip Number is required.");
      if (form.gross_salary <= 0) throw new Error("Gross Salary must be greater than 0.");

      // Find actual employee record to resolve UUID foreign key
      const emp = employees.find(
        (e) =>
          e.id === form.employee_id ||
          e.employee_code === form.employee_id ||
          (e as any).employee_id === form.employee_id ||
          (form.employee_name && e.full_name?.toLowerCase() === form.employee_name?.toLowerCase())
      );

      const empUuid = emp?.id || (isUuid(form.employee_id) ? form.employee_id : employees[0]?.id);
      if (!empUuid) {
        throw new Error("Valid employee record could not be found in database.");
      }

      // Map to exact Supabase PostgreSQL payslips table schema
      const dbPayload = {
        employee_id: empUuid,
        payslip_number: form.payslip_number,
        salary_period_start: form.salary_period_start,
        salary_period_end: form.salary_period_end,
        salary_period_label: form.salary_period_label || null,
        employee_name_snapshot: form.employee_name,
        employee_id_snapshot: form.employee_id,
        designation_snapshot: emp?.designation || null,
        department_snapshot: emp?.department || null,
        payment_mode_snapshot: form.payment_mode || "Bank Transfer",
        office_timing_snapshot: form.office_timing || null,
        absent_days_snapshot: Number(form.absent_days ?? 0),
        late_minutes_snapshot: Number(form.late_minutes ?? 0),
        gross_salary: Number(form.gross_salary ?? 0),
        absent_deduction: Number(form.absent_deduction ?? 0),
        late_deduction: Number(form.late_deduction ?? 0),
        total_deduction: Number(form.total_deduction ?? 0),
        net_salary: Number(form.net_salary ?? 0),
        payment_status: form.payment_status || "Paid",
        status: form.status || "Published",
        updated_at: new Date().toISOString(),
      };

      if (isEditing && isUuid(form.id)) {
        if (!isSuperAdmin) {
          throw new Error("Only Super Admin can edit existing payslips.");
        }
        const { error } = await supabase.from("payslips").update(dbPayload as any).eq("id", form.id);
        if (error) throw error;
      } else {
        if (!isManager) {
          throw new Error("You do not have permission to create payslips.");
        }
        const { error } = await supabase.from("payslips").insert(dbPayload as any);
        if (error) throw error;
      }

      await logAuditEvent({
        action: isEditing ? "UPDATE_PAYSLIP" : "CREATE_PAYSLIP",
        entity_type: "payslip",
        entity_id: form.payslip_number,
        description: `${isEditing ? "Updated" : "Created"} salary slip ${form.payslip_number} for ${form.employee_name} (Gross: ₹${form.gross_salary}, Net: ₹${form.net_salary})`,
        details: {
          payslip_number: form.payslip_number,
          employee_id: form.employee_id,
          employee_name: form.employee_name,
          gross_salary: form.gross_salary,
          total_deduction: form.total_deduction,
          net_salary: form.net_salary,
        },
      });

      return dbPayload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success(isEditing ? "Payslip updated successfully." : "Payslip created successfully.");
      navigate({ to: "/payslips" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save payslip");
    },
  });

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      setIsGeneratingPdf(true);
      toast.info("Generating PDF and uploading to Supabase Storage...");
      const pdf = await generatePayslipPDF(printRef.current, `Payslip_${form.payslip_number}.pdf`);
      const blob = pdf.output("blob");

      // Upload to Supabase Storage
      const dateParts = (form.salary_period_start || new Date().toISOString()).split("-");
      const year = dateParts[0] || new Date().getFullYear();
      const month = dateParts[1] || new Date().getMonth() + 1;

      const uploadRes = await uploadPayslipPDF(
        blob,
        year,
        month,
        form.employee_id,
        form.payslip_number
      );
      if (isUuid(form.id)) {
        const { error: pdfMetaErr } = await supabase.rpc("touch_payslip_pdf_meta" as never, {
          p_id: form.id,
          p_path: uploadRes.ref,
          p_size: uploadRes.sizeBytes ?? null,
          p_generated_at: new Date().toISOString(),
        } as never);
        if (pdfMetaErr && isSuperAdmin) {
          await supabase.from("payslips").update({
            pdf_storage_path: uploadRes.ref,
            pdf_file_size: uploadRes.sizeBytes ?? null,
            pdf_generated_at: new Date().toISOString(),
          } as any).eq("id", form.id);
        }
      }

      pdf.save(`Payslip_${form.payslip_number}.pdf`);
      toast.success("Payslip PDF saved to Supabase Storage (payslips) & downloaded.");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/payslips" })}
            className="mb-1"
          >
            <ArrowLeft className="size-4 mr-1.5" /> Back to Payslips
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Payslip" : "Create New Payslip"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter payroll & attendance details to generate an official BLX Realty salary slip.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
            <Eye className="size-4 mr-1.5" /> Preview PDF
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
            <Download className="size-4 mr-1.5" /> Download PDF
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="size-4 mr-1.5" /> Print
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-primary text-primary-foreground font-semibold"
          >
            <Save className="size-4 mr-1.5" />
            {isEditing ? "Update Payslip" : "Save Payslip"}
          </Button>
        </div>
      </div>

      {/* Form Sections */}
      <div className="no-print grid gap-6 lg:grid-cols-2">
        {/* SECTION A: COMPANY INFORMATION */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Building2 className="size-5" />
              <CardTitle className="text-base">A. Company Information</CardTitle>
            </div>
            <CardDescription>Branding information printed on the salary slip header.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="company_website">Website</Label>
              <Input
                id="company_website"
                value={form.company_website}
                onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))}
              />
            </div>
            <div>
              <Label>Company Logo</Label>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-12 w-28 rounded border bg-muted/40 p-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={form.company_logo || "/apple-touch-icon.png"}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <label htmlFor="cms-company-logo" className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    <Upload className="size-3.5" /> Replace Logo
                  </span>
                  <input
                    id="cms-company-logo"
                    name="cms-company-logo"
                    aria-label="Replace Company Logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload("company_logo", e.target.files?.[0] || null)}
                  />
                </label>
                {form.company_logo !== "/apple-touch-icon.png" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((p) => ({ ...p, company_logo: "/apple-touch-icon.png" }))}
                    className="text-xs text-muted-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION B: PAYSLIP INFORMATION */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <User className="size-5" />
              <CardTitle className="text-base">B. Payslip & Employee Information</CardTitle>
            </div>
            <CardDescription>Select an existing employee or enter details manually.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {employees.length > 0 && (
              <div>
                <Label>Select from Employee Database</Label>
                <Select onValueChange={handleSelectEmployee}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="-- Choose an employee to auto-fill --" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({(emp as any).employee_id || emp.employee_code || "BLX26"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="payslip_number">Payslip No. *</Label>
                <Input
                  id="payslip_number"
                  value={form.payslip_number}
                  onChange={(e) => setForm((p) => ({ ...p, payslip_number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="employee_id">Employee ID *</Label>
                <Input
                  id="employee_id"
                  value={form.employee_id}
                  onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="employee_name">Employee Name *</Label>
              <Input
                id="employee_name"
                value={form.employee_name}
                onChange={(e) => setForm((p) => ({ ...p, employee_name: e.target.value }))}
                placeholder="e.g. Abhishek"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="salary_period_start">Period Start</Label>
                <Input
                  id="salary_period_start"
                  type="date"
                  value={form.salary_period_start}
                  onChange={(e) => setForm((p) => ({ ...p, salary_period_start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="salary_period_end">Period End</Label>
                <Input
                  id="salary_period_end"
                  type="date"
                  value={form.salary_period_end}
                  onChange={(e) => setForm((p) => ({ ...p, salary_period_end: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="payment_mode">Payment Mode</Label>
              <Input
                id="payment_mode"
                value={form.payment_mode}
                onChange={(e) => setForm((p) => ({ ...p, payment_mode: e.target.value }))}
                placeholder="e.g. Bank Transfer"
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION C: ATTENDANCE SUMMARY */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Calendar className="size-5" />
              <CardTitle className="text-base">C. Attendance Summary</CardTitle>
            </div>
            <CardDescription>
              Attendance factors used to compute absent and late arrival deductions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="absent_days">Absent Days</Label>
                <Input
                  id="absent_days"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.absent_days}
                  onChange={(e) => handleRecalculate(form.gross_salary, Number(e.target.value), form.late_minutes)}
                />
              </div>
              <div>
                <Label htmlFor="late_minutes">Late Minutes Beyond 10:45 AM</Label>
                <Input
                  id="late_minutes"
                  type="number"
                  min="0"
                  value={form.late_minutes}
                  onChange={(e) => handleRecalculate(form.gross_salary, form.absent_days, Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="office_timing">Office Timing</Label>
              <Input
                id="office_timing"
                value={form.office_timing}
                onChange={(e) => setForm((p) => ({ ...p, office_timing: e.target.value }))}
                placeholder="10:30 AM - 6:30 PM"
              />
            </div>

            <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>Automatic Deduction Formula:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleRecalculate(form.gross_salary, form.absent_days, form.late_minutes)}
              >
                <Calculator className="size-3 mr-1 text-primary" /> Recalculate Deductions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SECTION D: EARNINGS & DEDUCTIONS */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <IndianRupee className="size-5" />
              <CardTitle className="text-base">D. Earnings & Deductions</CardTitle>
            </div>
            <CardDescription>
              Real-time decimal-safe calculation matching BLX Realty's payroll standard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gross_salary">Gross Salary (₹) *</Label>
              <Input
                id="gross_salary"
                type="number"
                min="0"
                step="0.01"
                value={form.gross_salary}
                onChange={(e) => handleRecalculate(Number(e.target.value), form.absent_days, form.late_minutes)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="absent_deduction">Absent Deduction (₹)</Label>
                <Input
                  id="absent_deduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.absent_deduction}
                  onChange={(e) => handleDeductionChange("absent_deduction", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="late_deduction">Late Deduction (₹)</Label>
                <Input
                  id="late_deduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.late_deduction}
                  onChange={(e) => handleDeductionChange("late_deduction", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="rounded-md bg-muted p-2.5">
                <span className="text-xs text-muted-foreground block">Total Deduction:</span>
                <span className="text-base font-bold text-destructive">
                  - ₹ {formatIndianCurrency(form.total_deduction)}
                </span>
              </div>
              <div className="rounded-md bg-primary/10 p-2.5">
                <span className="text-xs text-primary font-medium block">NET SALARY PAYABLE:</span>
                <span className="text-lg font-extrabold text-primary">
                  ₹ {formatIndianCurrency(form.net_salary)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION E: PAYMENT INFORMATION */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">E. Payment Information</CardTitle>
            <CardDescription>Payment confirmation line displayed on the slip.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="payment_status">Payment Status Line</Label>
            <Input
              id="payment_status"
              value={form.payment_status}
              onChange={(e) => setForm((p) => ({ ...p, payment_status: e.target.value }))}
              placeholder="e.g. Processed through Bank Transfer"
            />
          </CardContent>
        </Card>

        {/* SECTION F: SIGNATURES */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">F. Signatures & Approvals</CardTitle>
            <CardDescription>Upload signatures or leave blank for physical signing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="signatory_label">Authorized Signatory Label</Label>
              <Input
                id="signatory_label"
                value={form.authorized_signatory_label}
                onChange={(e) => setForm((p) => ({ ...p, authorized_signatory_label: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cms-auth-signature" className="text-xs">Authorized Signature Image</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label htmlFor="cms-auth-signature" className="cursor-pointer">
                    <span className="inline-flex items-center gap-1 rounded border bg-background px-2.5 py-1 text-xs hover:bg-accent">
                      <Upload className="size-3" /> Upload
                    </span>
                    <input
                      id="cms-auth-signature"
                      name="cms-auth-signature"
                      aria-label="Upload Authorized Signature Image"
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
                      onClick={() => setForm((p) => ({ ...p, authorized_signature: null }))}
                      className="h-7 text-xs text-destructive"
                    >
                      <Trash2 className="size-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="cms-emp-signature" className="text-xs">Employee Signature Image</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label htmlFor="cms-emp-signature" className="cursor-pointer">
                    <span className="inline-flex items-center gap-1 rounded border bg-background px-2.5 py-1 text-xs hover:bg-accent">
                      <Upload className="size-3" /> Upload
                    </span>
                    <input
                      id="cms-emp-signature"
                      name="cms-emp-signature"
                      aria-label="Upload Employee Signature Image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleImageUpload("employee_signature", e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  {form.employee_signature && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((p) => ({ ...p, employee_signature: null }))}
                      className="h-7 text-xs text-destructive"
                    >
                      <Trash2 className="size-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Document Preview Section */}
      <div className="mt-10">
        <div className="no-print flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Live Document Preview</h2>
            <p className="text-xs text-muted-foreground">
              Real-time reproduction of the reference salary slip as it will appear in the generated PDF.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
              <Download className="size-3.5 mr-1.5" /> Download PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="size-3.5 mr-1.5" /> Print
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4 sm:p-8 flex justify-center">
          <PayslipDocument ref={printRef} data={form} />
        </div>
      </div>

      {/* PDF Preview Modal Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslip PDF Preview</DialogTitle>
            <DialogDescription>
              Verify the exact layout, borders, amounts, and logo before downloading.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 flex justify-center">
            <PayslipDocument data={form} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="size-4 mr-1.5" /> Print
            </Button>
            <Button onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
              <Download className="size-4 mr-1.5" /> Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
