import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { useSettings } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import type { CompanySettings } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data } = useSettings();
  const [form, setForm] = useState<Partial<CompanySettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.id) throw new Error("Settings not loaded yet");
      const { id, ...patch } = form;
      const { error } = await supabase
        .from("company_settings")
        .update({
          ...patch,
          grace_minutes: Number(patch.grace_minutes ?? 0),
          late_block_minutes: Number(patch.late_block_minutes ?? 0),
          late_block_amount: Number(patch.late_block_amount ?? 0),
          fixed_days_per_month: Number(patch.fixed_days_per_month ?? 26),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_settings"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const text = (key: keyof CompanySettings, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        disabled={!isAdmin}
        value={(form[key] as string | number | undefined) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Company settings"
        description="Office timings, late arrival rules and payslip branding."
        actions={
          isAdmin ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save changes
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Company profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {text("company_name", "Company name")}
            {text("website", "Website")}
            {text("authorized_signatory", "Authorized signatory")}
            {text("logo_url", "Logo URL")}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payslip_footer">Payslip footer note</Label>
              <Textarea
                id="payslip_footer"
                disabled={!isAdmin}
                value={form.payslip_footer ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, payslip_footer: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Attendance & payroll rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {text("office_start", "Office start time", "time")}
            {text("office_end", "Office end time", "time")}
            {text("grace_minutes", "Grace period (minutes)", "number")}
            {text("late_block_minutes", "Late deduction block (minutes)", "number")}
            {text("late_block_amount", "Deduction per block (₹)", "number")}
            {text("fixed_days_per_month", "Fixed days per month", "number")}
            <div className="space-y-2">
              <Label>Salary day basis</Label>
              <Select
                disabled={!isAdmin}
                value={form.salary_day_basis ?? "calendar_days"}
                onValueChange={(v) => setForm((f) => ({ ...f, salary_day_basis: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar_days">Calendar days</SelectItem>
                  <SelectItem value="fixed_days">Fixed days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
