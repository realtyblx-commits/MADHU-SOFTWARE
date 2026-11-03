import React from "react";
import { PayslipRecord, formatIndianCurrency, formatSalaryMonthYear } from "@/lib/payroll";
import { resolveStorageUrl } from "@/lib/storage";

interface PayslipDocumentProps {
  data: PayslipRecord;
  id?: string;
}

export const PayslipDocument = React.forwardRef<HTMLDivElement, PayslipDocumentProps>(
  ({ data, id = "payslip-render-node" }, ref) => {
    const [logoUrl, setLogoUrl] = React.useState(data.company_logo || "/apple-touch-icon.png");
    const [empSigUrl, setEmpSigUrl] = React.useState(data.employee_signature || "");
    const [authSigUrl, setAuthSigUrl] = React.useState(data.authorized_signature || "");

    React.useEffect(() => {
      let cancelled = false;
      (async () => {
        const [logo, emp, auth] = await Promise.all([
          data.company_logo && data.company_logo !== "/apple-touch-icon.png"
            ? resolveStorageUrl(data.company_logo)
            : Promise.resolve("/apple-touch-icon.png"),
          data.employee_signature ? resolveStorageUrl(data.employee_signature) : Promise.resolve(""),
          data.authorized_signature ? resolveStorageUrl(data.authorized_signature) : Promise.resolve(""),
        ]);
        if (cancelled) return;
        setLogoUrl(logo || "/apple-touch-icon.png");
        setEmpSigUrl(emp || "");
        setAuthSigUrl(auth || "");
      })();
      return () => {
        cancelled = true;
      };
    }, [data.company_logo, data.employee_signature, data.authorized_signature]);

    // Format Month & Year
    const salaryMonthYear = React.useMemo(() => {
      return formatSalaryMonthYear(data.salary_period_start, data.salary_period_end, data.salary_period_label);
    }, [data.salary_period_start, data.salary_period_end, data.salary_period_label]);

    // Format period nicely if start and end are provided
    const periodDisplay = React.useMemo(() => {
      if (data.salary_period_label) return data.salary_period_label;
      if (data.salary_period_start && data.salary_period_end) {
        try {
          const d1 = new Date(data.salary_period_start);
          const d2 = new Date(data.salary_period_end);
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
            return `${d1.toLocaleDateString("en-GB", opt)} - ${d2.toLocaleDateString("en-GB", opt)}`;
          }
        } catch {}
        return `${data.salary_period_start} - ${data.salary_period_end}`;
      }
      return "—";
    }, [data.salary_period_label, data.salary_period_start, data.salary_period_end]);

    return (
      <div
        ref={ref}
        id={id}
        className="payslip-container mx-auto w-full max-w-[780px] bg-white text-black p-8 sm:p-12 border border-black shadow-lg print:shadow-none print:border-none print:p-6"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          color: "#000000",
          backgroundColor: "#ffffff",
          borderColor: "#000000",
        }}
      >
        {/* Header: Centered Logo & Company Details */}
        <div className="text-center mb-6">
          <img
            src={logoUrl || "/apple-touch-icon.png"}
            alt="BLX REALTY"
            className="h-16 mx-auto object-contain mb-3 block"
            crossOrigin="anonymous"
          />
          <h1 className="text-xl font-bold tracking-tight uppercase text-black">
            {data.company_name || "BLX REALTY PRIVATE LIMITED"}
          </h1>
          <p className="text-sm text-black mt-1 font-normal">
            Website: {data.company_website || "www.theblxrealty.com"}
          </p>
        </div>

        {/* Document Title Header */}
        <div className="text-center mb-4 border-t border-b border-black py-2 bg-[#f3f4f6]">
          <h2 className="text-base font-bold tracking-wider uppercase text-black">
            EMPLOYEE PAYSLIP
          </h2>
        </div>

        {/* Table 1: Employee Information Table */}
        <div className="border border-black overflow-hidden mb-4">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-black">
                <td className="w-2/5 border-r border-black px-4 py-2 font-medium text-black">
                  Payslip No.
                </td>
                <td className="w-3/5 px-4 py-2 text-black">{data.payslip_number}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-2/5 border-r border-black px-4 py-2 font-medium text-black">
                  Employee ID
                </td>
                <td className="w-3/5 px-4 py-2 text-black">{data.employee_id}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-2/5 border-r border-black px-4 py-2 font-medium text-black">
                  Employee Name
                </td>
                <td className="w-3/5 px-4 py-2 text-black font-medium">{data.employee_name}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-2/5 border-r border-black px-4 py-2 font-medium text-black">
                  Salary Month & Year
                </td>
                <td className="w-3/5 px-4 py-2 text-black font-semibold">{salaryMonthYear}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="w-2/5 border-r border-black px-4 py-2 font-medium text-black">
                  Salary Period
                </td>
                <td className="w-3/5 px-4 py-2 text-black">{periodDisplay}</td>
              </tr>
              <tr>
                <td className="w-2/5 border-r border-black px-4 py-2 font-medium text-black">
                  Payment Mode
                </td>
                <td className="w-3/5 px-4 py-2 text-black">{data.payment_mode || "Bank Transfer"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 2: Attendance Summary Table */}
        <div className="border border-black overflow-hidden mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black bg-[#e5e7eb]">
                <th className="w-3/5 border-r border-black px-4 py-2 text-left font-bold text-black">
                  Attendance Summary
                </th>
                <th className="w-2/5 px-4 py-2 text-left font-bold text-black">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black px-4 py-2 text-black">Absent Days</td>
                <td className="px-4 py-2 text-black">{data.absent_days}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black px-4 py-2 text-black">
                  Late Minutes Beyond 10:45 AM
                </td>
                <td className="px-4 py-2 text-black">{data.late_minutes}</td>
              </tr>
              <tr>
                <td className="border-r border-black px-4 py-2 text-black">Office Timing</td>
                <td className="px-4 py-2 text-black">{data.office_timing || "10:30 AM - 6:30 PM"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 3: Earnings & Deductions Table */}
        <div className="border border-black overflow-hidden mb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black bg-[#e5e7eb]">
                <th className="w-3/5 border-r border-black px-4 py-2 text-left font-bold text-black">
                  Earnings & Deductions
                </th>
                <th className="w-2/5 px-4 py-2 text-left font-bold text-black">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black px-4 py-2 text-black">Gross Salary</td>
                <td className="px-4 py-2 text-black font-medium">
                  {formatIndianCurrency(data.gross_salary)}
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black px-4 py-2 text-black">Absent Deduction</td>
                <td className="px-4 py-2 text-black">
                  {data.absent_deduction > 0
                    ? `- ${formatIndianCurrency(data.absent_deduction)}`
                    : formatIndianCurrency(0)}
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black px-4 py-2 text-black">Late Deduction</td>
                <td className="px-4 py-2 text-black">
                  {data.late_deduction > 0
                    ? `- ${formatIndianCurrency(data.late_deduction)}`
                    : formatIndianCurrency(0)}
                </td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black px-4 py-2 text-black">Total Deduction</td>
                <td className="px-4 py-2 text-black">
                  {data.total_deduction > 0
                    ? `- ${formatIndianCurrency(data.total_deduction)}`
                    : formatIndianCurrency(0)}
                </td>
              </tr>
              <tr className="font-bold">
                <td className="border-r border-black px-4 py-2.5 text-black">NET SALARY PAYABLE</td>
                <td className="px-4 py-2.5 text-black font-bold">
                  {formatIndianCurrency(data.net_salary)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Status */}
        <div className="mt-8 text-sm text-black">
          <p>
            Payment Status: {data.payment_status || "Processed through Bank Transfer"}
          </p>
        </div>

        {/* Signatures Section */}
        <div className="mt-10 pt-4 space-y-6 text-sm text-black">
          {/* Employee Signature */}
          <div className="flex items-end gap-2">
            <span className="font-semibold text-black whitespace-nowrap leading-none pb-1">
              Employee Signature:
            </span>
            <div className="relative w-64 h-14 flex items-end justify-center">
              {empSigUrl ? (
                <img
                  src={empSigUrl}
                  alt="Employee Signature"
                  className="max-h-14 max-w-full object-contain relative z-10 block mb-[-1px]"
                  crossOrigin="anonymous"
                />
              ) : null}
              <div className="absolute bottom-0 left-0 right-0 border-b border-black pointer-events-none" />
            </div>
          </div>

          {/* Authorized Signatory */}
          <div className="flex items-end gap-2">
            <span className="font-semibold text-black whitespace-nowrap leading-none pb-1">
              {data.authorized_signatory_label || "Authorized Signatory (BLX Realty Pvt Ltd)"}:
            </span>
            <div className="relative w-64 h-14 flex items-end justify-center">
              {authSigUrl ? (
                <img
                  src={authSigUrl}
                  alt="Authorized Signature"
                  className="max-h-14 max-w-full object-contain relative z-10 block mb-[-1px]"
                  crossOrigin="anonymous"
                />
              ) : null}
              <div className="absolute bottom-0 left-0 right-0 border-b border-black pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PayslipDocument.displayName = "PayslipDocument";
