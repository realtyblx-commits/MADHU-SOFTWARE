import { createFileRoute } from "@tanstack/react-router";
import { PayslipCMS } from "@/components/payslips/PayslipCMS";

export const Route = createFileRoute("/_authenticated/payslips/create")({
  component: CreatePayslipPage,
});

function CreatePayslipPage() {
  return <PayslipCMS />;
}
