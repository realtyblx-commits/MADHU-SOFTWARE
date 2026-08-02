import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { useEmployees } from "@/lib/queries";
import { MONTHS, inr, monthLabel, type PayrollRow } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/payslips/")({
  component: PayslipsPage,
});

function PayslipsPage() {
  const { data: employees = [] } = useEmployees();
  const [query, setQuery] = useState("");

  const { data: payrolls = [] } = useQuery({
    queryKey: ["payroll-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayrollRow[];
    },
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payrolls.filter((p) => {
      if (!q) return true;
      const emp = employees.find((e) => e.id === p.employee_id);
      return [emp?.full_name, emp?.employee_code, p.payslip_number, MONTHS[p.period_month - 1]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [payrolls, employees, query]);

  return (
    <div>
      <PageHeader title="Payslips" description="Search, view and print salary slips by month." />

      <Card className="shadow-panel">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search employee, code or payslip number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payslip no.</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Net salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No payslips generated yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="num">{p.payslip_number}</TableCell>
                    <TableCell>
                      {employees.find((e) => e.id === p.employee_id)?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>{monthLabel(p.period_month, p.period_year)}</TableCell>
                    <TableCell className="num text-right font-semibold">
                      {inr(p.net_salary)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.locked ? "default" : "secondary"}>
                        {p.locked ? "Finalized" : p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/payslips/$id" params={{ id: p.id }}>
                          <FileText className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
