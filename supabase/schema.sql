-- ====================================================================
-- 🔥 BLX REALTY PAYROLL — COMPLETE SUPABASE PRODUCTION SCHEMA
-- Single, Comprehensive, Idempotent Initialization Script
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ROLES & ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'employee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. COMMON TRIGGER FOR updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ====================================================================
-- 4. TABLE: profiles (Linked 1:1 with auth.users)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create profile on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 5. TABLE: user_roles
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'employee',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_payroll_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'hr')
  );
$$;

-- Default first user to admin, others to employee
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  role_count int;
  requested_role text;
BEGIN
  SELECT count(*) INTO role_count FROM public.user_roles;
  requested_role := NEW.raw_user_meta_data->>'role';

  IF requested_role = 'admin' OR role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- ====================================================================
-- 6. TABLE: company_settings
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'BLX REALTY PRIVATE LIMITED',
  logo_url text DEFAULT '/apple-touch-icon.png',
  website text NOT NULL DEFAULT 'www.theblxrealty.com',
  office_start time NOT NULL DEFAULT '10:30',
  office_end time NOT NULL DEFAULT '18:30',
  late_threshold text NOT NULL DEFAULT '10:45 AM',
  grace_minutes int NOT NULL DEFAULT 15,
  late_block_minutes int NOT NULL DEFAULT 30,
  late_block_amount numeric NOT NULL DEFAULT 500,
  salary_day_basis text NOT NULL DEFAULT 'Fixed Days',
  fixed_days_per_month int NOT NULL DEFAULT 30,
  default_payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  default_currency text NOT NULL DEFAULT '₹',
  payslip_prefix text NOT NULL DEFAULT 'PS-',
  employee_id_prefix text NOT NULL DEFAULT 'BLX26-',
  payslip_footer text NOT NULL DEFAULT 'This is a computer-generated salary slip and does not require a physical signature.',
  authorized_signatory text NOT NULL DEFAULT 'Authorized Signatory (BLX Realty Pvt Ltd)',
  authorized_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TRIGGER trg_company_settings_updated
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Insert default company settings if none exist
INSERT INTO public.company_settings (id, company_name, website, logo_url)
SELECT '00000000-0000-0000-0000-000000000001', 'BLX REALTY PRIVATE LIMITED', 'www.theblxrealty.com', '/apple-touch-icon.png'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- ====================================================================
-- 7. TABLE: employees
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  designation text,
  department text,
  joining_date date,
  employment_status text NOT NULL DEFAULT 'Active',
  mobile text,
  email text,
  address text,
  pan text,
  aadhaar text,
  bank_name text,
  account_number text,
  ifsc_code text,
  payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  gross_salary numeric NOT NULL DEFAULT 0,
  aadhaar_card_doc text,
  pan_card_doc text,
  bank_passbook_doc text,
  photo_doc text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TRIGGER trg_employees_updated
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(employment_status);

-- Helper function to resolve employee id for current auth user
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ====================================================================
-- 8. TABLE: attendance
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  scheduled_check_in time NOT NULL DEFAULT '10:30',
  check_in time,
  scheduled_check_out time NOT NULL DEFAULT '18:30',
  check_out time,
  working_hours numeric NOT NULL DEFAULT 0,
  late_minutes int NOT NULL DEFAULT 0,
  early_departure_minutes int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Present',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);

-- Deterministic calculation trigger for late_minutes & working_hours
CREATE OR REPLACE FUNCTION public.compute_attendance_metrics()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  s public.company_settings%ROWTYPE;
  cutoff time;
BEGIN
  SELECT * INTO s FROM public.company_settings LIMIT 1;

  -- 1. Late arrival calculation (Scheduled 10:30 + Grace 15m = 10:45 AM threshold)
  IF NEW.check_in IS NOT NULL THEN
    cutoff := COALESCE(s.office_start, '10:30'::time) + make_interval(mins => COALESCE(s.grace_minutes, 15));
    IF NEW.check_in > cutoff THEN
      NEW.late_minutes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (NEW.check_in - cutoff)) / 60)::int);
    ELSE
      NEW.late_minutes := 0;
    END IF;
  END IF;

  -- 2. Working hours calculation (check_out - check_in in decimal hours)
  IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
    IF NEW.check_out >= NEW.check_in THEN
      NEW.working_hours := ROUND((EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600)::numeric, 2);
    ELSE
      NEW.working_hours := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_metrics ON public.attendance;
CREATE TRIGGER trg_attendance_metrics
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.compute_attendance_metrics();

-- ====================================================================
-- 9. TABLE: payroll
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month int NOT NULL,
  period_year int NOT NULL,
  salary_period_start date,
  salary_period_end date,
  payslip_number text NOT NULL UNIQUE,
  gross_salary numeric NOT NULL DEFAULT 0,
  total_days int NOT NULL DEFAULT 30,
  payable_days numeric NOT NULL DEFAULT 30,
  present_days numeric NOT NULL DEFAULT 0,
  absent_days numeric NOT NULL DEFAULT 0,
  late_minutes int NOT NULL DEFAULT 0,
  per_day_salary numeric NOT NULL DEFAULT 0,
  absent_deduction numeric NOT NULL DEFAULT 0,
  late_deduction numeric NOT NULL DEFAULT 0,
  additional_earnings numeric NOT NULL DEFAULT 0,
  additional_deductions numeric NOT NULL DEFAULT 0,
  total_deduction numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  payment_status text NOT NULL DEFAULT 'Pending',
  status text NOT NULL DEFAULT 'Draft',
  locked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_month, period_year)
);

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TRIGGER trg_payroll_updated
  BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payroll_emp_period ON public.payroll(employee_id, period_year, period_month);

-- ====================================================================
-- 10. TABLE: payroll_adjustments
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES public.payroll(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'earning', -- 'earning' or 'deduction'
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 11. TABLE: payslips (HISTORICAL SNAPSHOT REPOSITORY)
-- Preserves snapshot of all attributes at generation time so subsequent
-- employee changes (e.g. salary hike) never alter historical records.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payslip_number text NOT NULL UNIQUE,
  salary_period_start text NOT NULL,
  salary_period_end text NOT NULL,
  salary_period_label text,
  employee_name_snapshot text NOT NULL,
  employee_id_snapshot text NOT NULL,
  designation_snapshot text,
  department_snapshot text,
  payment_mode_snapshot text NOT NULL DEFAULT 'Bank Transfer',
  office_timing_snapshot text,
  absent_days_snapshot numeric NOT NULL DEFAULT 0,
  late_minutes_snapshot int NOT NULL DEFAULT 0,
  gross_salary numeric NOT NULL DEFAULT 0,
  absent_deduction numeric NOT NULL DEFAULT 0,
  late_deduction numeric NOT NULL DEFAULT 0,
  total_deduction numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Paid',
  pdf_storage_path text,
  pdf_file_size text,
  pdf_generated_at timestamptz,
  status text DEFAULT 'Published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TRIGGER trg_payslips_updated
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payslips_emp_id ON public.payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_number ON public.payslips(payslip_number);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON public.payslips(salary_period_start, salary_period_end);

-- ====================================================================
-- 12. TABLE: leave_requests
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'Casual Leave',
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'Pending',
  manager_approved_at timestamptz,
  hr_approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 13. TABLE: holidays
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 14. TABLE: audit_logs
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  user_email text NOT NULL,
  user_role text,
  description text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict boundary: Admins manage all; Employees access ONLY their own data.
-- ====================================================================

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_payroll_manager(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_payroll_manager(auth.uid()));

-- USER ROLES
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- COMPANY SETTINGS
DROP POLICY IF EXISTS "company_settings_read" ON public.company_settings;
CREATE POLICY "company_settings_read" ON public.company_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_settings_admin_write" ON public.company_settings;
CREATE POLICY "company_settings_admin_write" ON public.company_settings FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

-- EMPLOYEES
DROP POLICY IF EXISTS "employees_read" ON public.employees;
CREATE POLICY "employees_read" ON public.employees FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "employees_admin_write" ON public.employees;
CREATE POLICY "employees_admin_write" ON public.employees FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "employees_employee_update_own" ON public.employees;
CREATE POLICY "employees_employee_update_own" ON public.employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ATTENDANCE
DROP POLICY IF EXISTS "attendance_read" ON public.attendance;
CREATE POLICY "attendance_read" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR employee_id = public.get_current_employee_id());

DROP POLICY IF EXISTS "attendance_admin_write" ON public.attendance;
CREATE POLICY "attendance_admin_write" ON public.attendance FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "attendance_employee_insert_own" ON public.attendance;
CREATE POLICY "attendance_employee_insert_own" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_current_employee_id());

DROP POLICY IF EXISTS "attendance_employee_update_own" ON public.attendance;
CREATE POLICY "attendance_employee_update_own" ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id = public.get_current_employee_id())
  WITH CHECK (employee_id = public.get_current_employee_id());

-- PAYROLL
DROP POLICY IF EXISTS "payroll_admin_all" ON public.payroll;
CREATE POLICY "payroll_admin_all" ON public.payroll FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "payroll_employee_read_locked" ON public.payroll;
CREATE POLICY "payroll_employee_read_locked" ON public.payroll FOR SELECT TO authenticated
  USING (employee_id = public.get_current_employee_id() AND locked = true);

-- PAYROLL ADJUSTMENTS
DROP POLICY IF EXISTS "adjustments_admin_all" ON public.payroll_adjustments;
CREATE POLICY "adjustments_admin_all" ON public.payroll_adjustments FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

-- PAYSLIPS
DROP POLICY IF EXISTS "payslips_read" ON public.payslips;
CREATE POLICY "payslips_read" ON public.payslips FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR employee_id = public.get_current_employee_id());

DROP POLICY IF EXISTS "payslips_admin_write" ON public.payslips;
CREATE POLICY "payslips_admin_write" ON public.payslips FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

-- LEAVE REQUESTS
DROP POLICY IF EXISTS "leave_read" ON public.leave_requests;
CREATE POLICY "leave_read" ON public.leave_requests FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR employee_id = public.get_current_employee_id());

DROP POLICY IF EXISTS "leave_admin_write" ON public.leave_requests;
CREATE POLICY "leave_admin_write" ON public.leave_requests FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "leave_employee_insert_own" ON public.leave_requests;
CREATE POLICY "leave_employee_insert_own" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_current_employee_id());

-- HOLIDAYS
DROP POLICY IF EXISTS "holidays_read" ON public.holidays;
CREATE POLICY "holidays_read" ON public.holidays FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "holidays_admin_write" ON public.holidays;
CREATE POLICY "holidays_admin_write" ON public.holidays FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

-- AUDIT LOGS
DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_all" ON public.audit_logs FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid()))
  WITH CHECK (public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ====================================================================
-- 16. SUPABASE STORAGE BUCKETS & POLICIES
-- Buckets:
--   1. company-assets: Logos, signatures, company branding
--   2. payslips: Generated PDF salary slip documents
--   3. employee-documents: KYC records (Aadhaar, PAN, Passbook, custom)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('company-assets', 'company-assets', true),
  ('payslips', 'payslips', false),
  ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- company-assets: Public read, admin write
DROP POLICY IF EXISTS "company_assets_public_read" ON storage.objects;
CREATE POLICY "company_assets_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "company_assets_admin_insert" ON storage.objects;
CREATE POLICY "company_assets_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "company_assets_admin_update" ON storage.objects;
CREATE POLICY "company_assets_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "company_assets_admin_delete" ON storage.objects;
CREATE POLICY "company_assets_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_payroll_manager(auth.uid()));

-- payslips: Admin full access; Employee read-own
DROP POLICY IF EXISTS "payslips_admin_all" ON storage.objects;
CREATE POLICY "payslips_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payslips' AND public.is_payroll_manager(auth.uid()))
  WITH CHECK (bucket_id = 'payslips' AND public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "payslips_employee_read" ON storage.objects;
CREATE POLICY "payslips_employee_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payslips' AND
    name LIKE '%' || (SELECT employee_code FROM public.employees WHERE user_id = auth.uid() LIMIT 1) || '%'
  );

-- employee-documents: Admin full access; Employee access own documents
DROP POLICY IF EXISTS "employee_documents_admin_all" ON storage.objects;
CREATE POLICY "employee_documents_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'employee-documents' AND public.is_payroll_manager(auth.uid()))
  WITH CHECK (bucket_id = 'employee-documents' AND public.is_payroll_manager(auth.uid()));

DROP POLICY IF EXISTS "employee_documents_employee_read" ON storage.objects;
CREATE POLICY "employee_documents_employee_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents' AND
    name LIKE (SELECT employee_code FROM public.employees WHERE user_id = auth.uid() LIMIT 1) || '/%'
  );

DROP POLICY IF EXISTS "employee_documents_employee_insert" ON storage.objects;
CREATE POLICY "employee_documents_employee_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents' AND
    name LIKE (SELECT employee_code FROM public.employees WHERE user_id = auth.uid() LIMIT 1) || '/%'
  );

DROP POLICY IF EXISTS "employee_documents_employee_delete" ON storage.objects;
CREATE POLICY "employee_documents_employee_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents' AND
    name LIKE (SELECT employee_code FROM public.employees WHERE user_id = auth.uid() LIMIT 1) || '/%'
  );
