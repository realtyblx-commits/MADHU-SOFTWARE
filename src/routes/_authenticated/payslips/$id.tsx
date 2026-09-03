import React, { useState, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Download, Edit3, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAuditEvent } from "@/lib/audit";
import { dispatchPayslipNotification } from "@/lib/notifications";
import { PayslipRecord, mapPayrollToPayslip } from "@/lib/payroll";
import { generatePayslipPDF } from "@/lib/pdf-generator";
import { uploadPayslipPDF, deletePayslipPDF } from "@/lib/storage";
import { PayslipDocument } from "@/components/payslips/PayslipDocument";
import { PayslipCMS } from "@/components/payslips/PayslipCMS";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payslips/$id")({
  component: PayslipDetailPage,
});

function PayslipDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch payslip by ID from payslips or fallback to payroll table
  const { data: payslip, isLoading } = useQuery<PayslipRecord | null>({
    queryKey: ["payslip", id],
    queryFn: async () => {
      // Check in payslips table first
      const { data: ps } = await supabase.from("payslips").select("*").eq("id", id).maybeSingle();
      if (ps) return ps as unknown as PayslipRecord;

      // Fallback: check payroll table
      const { data: pr } = await supabase
        .from("payroll")
        .select("*, employees(*)")
        .eq("id", id)
        .maybeSingle();

      if (pr) return mapPayrollToPayslip(pr);
      return null;
    },
  });

  const { user } = useAuth();
  const hasNotifiedViewRef = useRef(false);

  React.useEffect(() => {
    if (payslip && !hasNotifiedViewRef.current) {
      hasNotifiedViewRef.current = true;
      dispatchPayslipNotification({
        action: "viewed",
        employeeName: payslip.employee_name,
        employeeCode: payslip.employee_id,
        payslipNumber: payslip.payslip_number,
        period: payslip.salary_period_label,
      });
      logAuditEvent({
        action: "VIEW_PAYSLIP",
        entity_type: "payslip",
        entity_id: payslip.payslip_number,
        user_email: user?.email || undefined,
        description: `Employee ${payslip.employee_name} viewed payslip ${payslip.payslip_number}`,
        details: {
          employee_id: payslip.employee_id,
          payslip_number: payslip.payslip_number,
        },
      });
    }
  }, [payslip, user]);

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // 1. Delete binary PDF from Supabase Storage if storage path exists
      if ((payslip as any)?.pdf_storage_path) {
        try {
          await deletePayslipPDF((payslip as any).pdf_storage_path);
        } catch (storageErr) {
          console.warn("Notice: storage cleanup on delete:", storageErr);
        }
      }

      // 2. Delete database records
      await supabase.from("payslips").delete().eq("id", id);
      await supabase.from("payroll").delete().eq("id", id);

      if (payslip) {
        await logAuditEvent({
          action: "DELETE_PAYSLIP",
          entity_type: "payslip",
          entity_id: payslip.payslip_number,
          description: `Deleted payslip ${payslip.payslip_number} for ${payslip.employee_name}`,
          details: {
            id,
            payslip_number: payslip.payslip_number,
            employee_name: payslip.employee_name,
            net_salary: payslip.net_salary,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Payslip deleted successfully.");
      navigate({ to: "/payslips" });
    },
    onError: (err: any) => {
      toast.error("Failed to delete payslip: " + err.message);
    },
  });

  const handleDownload = async () => {
    if (!printRef.current || !payslip) return;
    try {
      setIsDownloading(true);
      toast.info("Generating PDF and storing in Supabase Storage...");
      const pdf = await generatePayslipPDF(printRef.current, `Payslip_${payslip.payslip_number}.pdf`);
      const blob = pdf.output("blob");

      // Upload binary to Supabase Storage
      const dateParts = (payslip.salary_period_start || new Date().toISOString()).split("-");
      const year = dateParts[0] || new Date().getFullYear();
      const month = dateParts[1] || new Date().getMonth() + 1;

      try {
        const uploadRes = await uploadPayslipPDF(
          blob,
          year,
          month,
          payslip.employee_id,
          payslip.payslip_number
        );
        if (uploadRes.path) {
          await supabase.from("payslips").update({
            pdf_storage_path: uploadRes.path,
            pdf_generated_at: new Date().toISOString(),
          } as any).eq("id", id);
        }
      } catch (uploadErr) {
        console.warn("Storage upload notice:", uploadErr);
      }

      pdf.save(`Payslip_${payslip.payslip_number}.pdf`);
      dispatchPayslipNotification({
        action: "downloaded",
        employeeName: payslip.employee_name,
        employeeCode: payslip.employee_id,
        payslipNumber: payslip.payslip_number,
        period: payslip.salary_period_label,
      });
      await logAuditEvent({
        action: "DOWNLOAD_PDF",
        entity_type: "payslip",
        entity_id: payslip.payslip_number,
        description: `Exported PDF for payslip ${payslip.payslip_number} (${payslip.employee_name})`,
      });
      toast.success("PDF generated, stored in Supabase & downloaded.");
    } catch (err: any) {
      toast.error("Failed to download PDF: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">Loading payslip details…</div>;
  }

  if (!payslip) {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="text-muted-foreground">Payslip not found.</p>
        <Button asChild variant="outline">
          <Link to="/payslips">Back to Payslips</Link>
        </Button>
      </div>
    );
  }

  if (isEditing) {
    return <PayslipCMS initialData={payslip} isEditing={true} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/payslips">
            <ArrowLeft className="size-4 mr-1.5" /> Back to Payslips
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit3 className="size-4 mr-1.5" /> Edit Payslip
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
            <Download className="size-4 mr-1.5" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4 mr-1.5" /> Print
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Payslip Document Render Node */}
      <div className="flex justify-center p-2 sm:p-6 bg-muted/20 rounded-xl border">
        <PayslipDocument ref={printRef} data={payslip} />
      </div>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payslip {payslip.payslip_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the payslip for{" "}
              <strong>{payslip.employee_name}</strong>? This action cannot be undone and will update
              dashboard statistics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Payslip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
