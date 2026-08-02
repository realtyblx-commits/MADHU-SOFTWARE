import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/queries";
import { inr2, monthLabel, type Employee, type PayrollRow } from "@/lib/payroll";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/payslips/$id")({
  component: PayslipPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}

function PayslipPage() {
  const { id } = Route.useParams();
  const { data: settings } = useSettings();

  const { data } = useQuery({
    queryKey: ["payslip", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*, employees(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as (PayrollRow & { employees: Employee | null }) | null;
    },
  });

  if (!data) return <p className="text-muted-foreground">Loading payslip…</p>;
  const emp = data.employees;

  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link to="/payslips">
            <ArrowLeft className="size-4" /> Back to payslips
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print / Save as PDF
        </Button>
      </div>

      <div className="print-sheet mx-auto max-w-3xl rounded-lg border bg-card p-8 shadow-panel">
        <header className="flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-wide">
              {settings?.company_name ?? "BLX REALTY PRIVATE LIMITED"}
            </h1>
            <p className="text-xs text-muted-foreground">{settings?.website}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold uppercase tracking-widest">Salary Slip</p>
            <p className="num text-muted-foreground">{data.payslip_number}</p>
            <p className="text-muted-foreground">
              {monthLabel(data.period_month, data.period_year)}
            </p>
          </div>
        </header>

        <section className="grid gap-x-10 gap-y-1 py-4 md:grid-cols-2">
          <Row label="Employee name" value={emp?.full_name ?? "—"} />
          <Row label="Employee code" value={emp?.employee_code ?? "—"} />
          <Row label="Designation" value={emp?.designation ?? "—"} />
          <Row label="Department" value={emp?.department ?? "—"} />
          <Row label="Date of joining" value={emp?.joining_date ?? "—"} />
          <Row label="PAN" value={emp?.pan ?? "—"} />
          <Row label="Bank" value={emp?.bank_name ?? "—"} />
          <Row label="Account no." value={emp?.account_number ?? "—"} />
          <Row label="Payment mode" value={data.payment_mode} />
          <Row label="Total / payable days" value={`${data.total_days} / ${data.payable_days}`} />
        </section>

        <section className="grid gap-8 border-t pt-4 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider">Earnings</h2>
            <Row label="Gross salary" value={inr2(Number(data.gross_salary))} />
            <Row label="Additional earnings" value={inr2(Number(data.additional_earnings))} />
            <Row
              label="Total earnings"
              value={inr2(Number(data.gross_salary) + Number(data.additional_earnings))}
            />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider">Deductions</h2>
            <Row
              label={`Absent (${data.absent_days} days)`}
              value={inr2(Number(data.absent_deduction))}
            />
            <Row
              label={`Late arrivals (${data.late_minutes} min)`}
              value={inr2(Number(data.late_deduction))}
            />
            <Row label="Other deductions" value={inr2(Number(data.additional_deductions))} />
            <Row label="Total deductions" value={inr2(Number(data.total_deduction))} />
          </div>
        </section>

        <section className="mt-6 flex items-center justify-between rounded-md bg-secondary px-5 py-4">
          <span className="text-sm font-semibold uppercase tracking-wider">Net salary payable</span>
          <span className="num text-xl font-bold">₹ {inr2(Number(data.net_salary))}</span>
        </section>

        <footer className="mt-10 flex items-end justify-between text-xs text-muted-foreground">
          <p className="max-w-sm">
            {settings?.payslip_footer ?? "This is a computer generated salary slip."}
          </p>
          <div className="text-center">
            <div className="mb-1 h-10 w-40 border-b border-foreground/40" />
            <p>{settings?.authorized_signatory ?? "Authorized Signatory"}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
