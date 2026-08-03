# BLX Payroll Suite

Based on the provided salary slip template, here's a refined Antigravity prompt that is specifically tailored to BLX Realty's payroll process and matches the exact format of the salary slip.

Build an Enterprise Payroll & Salary Slip Management Module for BLX Realty CRM

Develop a complete Payroll Management Module within the existing BLX Realty CRM using React + TypeScript + Supabase + Tailwind CSS + shadcn/ui.

The objective is to manage employee information, attendance, leave tracking, salary calculations, and generate professional salary slips that exactly match the attached BLX Realty salary slip template.

Core Requirements

The module should allow HR/Admin to:

Manage employee records

Record daily attendance

Track leave and absences

Calculate salary automatically

Apply deductions for absences and late arrivals

Generate payroll monthly

Generate salary slips identical to the attached template

Download and print salary slips as PDF

Maintain payroll history

Employee Master

Create a complete Employee Management section.

Store:

Employee ID (Auto-generated)

Employee Code

Full Name

Designation

Department

Joining Date

Employment Status

Mobile Number

Email

Address

PAN

Aadhaar (Optional)

Bank Name

Account Number

IFSC Code

Payment Mode

Gross Monthly Salary

Attendance Management

Create a daily attendance system.

Each attendance record should store:

Employee

Date

Check In Time

Check Out Time

Working Hours

Attendance Status

Attendance Status:

Present

Absent

Half Day

Paid Leave

Unpaid Leave

Holiday

Week Off

Work From Home

Automatically calculate monthly totals.

Late Arrival Tracking

BLX Realty office timing is:

10:30 AM – 6:30 PM

Late calculation starts after 10:45 AM.

For every attendance record:

Calculate

Late Minutes = Check-in Time − 10:45 AM

Monthly summary should calculate:

Total Late Minutes

Total Late Hours

Allow HR/Admin to configure:

Grace Period

Late Deduction Rule

Example:

Every 60 late minutes = ₹X deduction

OR custom formula

This must be configurable from Company Settings.

Leave Management

Support leave requests.

Leave Types

Casual Leave

Sick Leave

Paid Leave

Leave Without Pay

Workflow

Employee

↓

Manager Approval

↓

HR Approval

↓

Attendance Updated Automatically

Salary Calculation

Each employee has:

Gross Salary

Example:

₹30,000

Automatically calculate

Gross Salary

↓

Absent Deduction

↓

Late Deduction

↓

Manual Adjustments

↓

Total Deduction

↓

Net Salary Payable

Support additional adjustments

Bonus

Incentive

Reimbursement

Advance Recovery

Other Deductions

Everything should be editable before payroll is finalized.

Payroll Processing

HR selects

Month

Year

↓

Generate Payroll

System automatically calculates:

Gross Salary

Attendance

Absent Days

Late Minutes

Absent Deduction

Late Deduction

Additional Earnings

Additional Deductions

Net Salary

Payroll should be locked after approval.

Only Admin can unlock.

Salary Slip

Generate a salary slip that matches the attached BLX Realty format exactly.

The layout should contain:

Header

Company Logo

BLX REALTY PRIVATE LIMITED

Website

Employee Payslip

Employee Information

Payslip Number

Employee ID

Employee Name

Salary Period

Payment Mode

Attendance Summary

Absent Days

Late Minutes Beyond 10:45 AM

Office Timing

10:30 AM – 6:30 PM

Earnings & Deductions

Gross Salary

Absent Deduction

Late Deduction

Additional Earnings (if any)

Additional Deductions (if any)

Total Deduction

NET SALARY PAYABLE

Footer

Payment Status

Employee Signature

Authorized Signatory

The generated PDF should visually match the attached template as closely as possible, including table layout, spacing, typography, alignment, borders, and branding.

PDF Features

Support

Preview

Download

Print

Filename format

EmployeeName_Month_Year.pdf

Generated PDF must preserve the exact layout.

Payroll History

Maintain complete payroll records.

Search by

Employee

Employee ID

Month

Year

Department

Allow

View

Download

Print

Regenerate PDF

Dashboard

Create Payroll Dashboard.

Cards

Total Employees

Payroll Generated

Pending Payroll

Total Salary Expense

Employees Absent Today

Leave Requests Pending

Charts

Monthly Payroll Cost

Attendance Trend

Leave Trend

Company Settings

Allow Admin to configure:

Company Name

Logo

Website

Office Timing

Grace Period

Late Deduction Formula

Default Payment Mode

Salary Slip Footer

Authorized Signatory

Changes should automatically reflect in all future salary slips.

Supabase Database

Create normalized tables:

employees

attendance

attendance_logs

leave_requests

leave_types

salary_structure

payroll

payroll_adjustments

salary_slips

company_settings

holidays

audit_logs

All tables should include:

created_at

updated_at

created_by

updated_by

Implement Row Level Security (RLS) and role-based access so employees can only access their own salary slips, while HR and Admin have full payroll management capabilities.

UI Requirements

Design should match the existing BLX Realty CRM.

Use:

Tailwind CSS

shadcn/ui

Responsive layout

Data tables with pagination

Global search

Sorting

Filters

Dark mode support

Additional Features

Bulk attendance import via Excel/CSV.

Bulk employee import.

Excel export for payroll registers.

Audit log for every payroll modification.

Salary revision history with effective dates.

Duplicate payroll prevention for the same employee and month.

Email salary slips to employees (optional).

Manual overrides before payroll finalization.

One-click monthly payroll generation.

Printable payroll register.

Future-ready architecture for biometric attendance integration, statutory deductions (PF/ESI/TDS), Form 16 generation, reimbursement management, and accounting software integration without major schema changes.

Important: Replicate the attached BLX Realty salary slip design as closely as possible, using a print-friendly HTML/CSS layout that renders consistently in PDF output. The salary slip should be pixel-accurate to the provided template while remaining fully dynamic with data fetched from Supabase.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f30b6a57-45fe-42d8-91c9-753ce10d12f5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
