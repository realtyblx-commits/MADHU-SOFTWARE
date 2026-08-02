import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BLX Realty Payroll — Employee Salary & Payslip Manager" },
      {
        name: "description",
        content:
          "Manage employees, attendance, late tracking, leave and monthly payroll, and generate BLX Realty salary slips.",
      },
      { property: "og:title", content: "BLX Realty Payroll" },
      {
        property: "og:description",
        content: "Employee, attendance and payroll management with printable BLX Realty payslips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
