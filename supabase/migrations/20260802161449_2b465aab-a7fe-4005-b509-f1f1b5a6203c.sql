-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ roles ============
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'employee');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_payroll_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','hr'));
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_payroll_manager(auth.uid()));

-- first signed-up user becomes admin, everyone else employee
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN cnt = 0 THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- ============ company settings ============
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'BLX REALTY PRIVATE LIMITED',
  logo_url text,
  website text NOT NULL DEFAULT 'www.blxrealty.com',
  office_start time NOT NULL DEFAULT '10:30',
  office_end time NOT NULL DEFAULT '18:30',
  grace_minutes int NOT NULL DEFAULT 15,
  late_block_minutes int NOT NULL DEFAULT 60,
  late_block_amount numeric NOT NULL DEFAULT 100,
  salary_day_basis text NOT NULL DEFAULT 'month_days',
  fixed_days_per_month int NOT NULL DEFAULT 26,
  default_payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  payslip_footer text NOT NULL DEFAULT 'This is a computer generated payslip and does not require a physical signature.',
  authorized_signatory text NOT NULL DEFAULT 'Authorized Signatory',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write" ON public.company_settings FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.company_settings DEFAULT VALUES;

-- ============ employees ============
CREATE TABLE public.employees (
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_read" ON public.employees FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "employees_write" ON public.employees FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- salary revision history
CREATE TABLE public.salary_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  gross_salary numeric NOT NULL,
  effective_from date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_structure TO authenticated;
GRANT ALL ON public.salary_structure TO service_role;
ALTER TABLE public.salary_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary_structure_read" ON public.salary_structure FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE POLICY "salary_structure_write" ON public.salary_structure FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_salary_structure_updated BEFORE UPDATE ON public.salary_structure FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ holidays ============
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays_read" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_write" ON public.holidays FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_holidays_updated BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ attendance ============
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  check_in time,
  check_out time,
  working_hours numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Present',
  late_minutes int NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (employee_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_read" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE POLICY "attendance_write" ON public.attendance FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto compute late minutes + working hours
CREATE OR REPLACE FUNCTION public.compute_attendance_metrics()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.company_settings%ROWTYPE; cutoff time;
BEGIN
  SELECT * INTO s FROM public.company_settings LIMIT 1;
  IF NEW.check_in IS NOT NULL AND s.id IS NOT NULL THEN
    cutoff := s.office_start + make_interval(mins => s.grace_minutes);
    IF NEW.check_in > cutoff THEN
      NEW.late_minutes := CEIL(EXTRACT(EPOCH FROM (NEW.check_in - cutoff)) / 60);
    ELSE
      NEW.late_minutes := 0;
    END IF;
  END IF;
  IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
    NEW.working_hours := ROUND((EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600)::numeric, 2);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_attendance_metrics BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.compute_attendance_metrics();

-- ============ leave requests ============
CREATE TABLE public.leave_requests (
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_read" ON public.leave_requests FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE POLICY "leave_write" ON public.leave_requests FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_leave_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ payroll ============
CREATE TABLE public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month int NOT NULL,
  period_year int NOT NULL,
  payslip_number text NOT NULL UNIQUE,
  gross_salary numeric NOT NULL DEFAULT 0,
  total_days int NOT NULL DEFAULT 0,
  payable_days numeric NOT NULL DEFAULT 0,
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
  created_by uuid,
  updated_by uuid,
  UNIQUE (employee_id, period_month, period_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_read" ON public.payroll FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));
CREATE POLICY "payroll_write" ON public.payroll FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES public.payroll(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'earning',
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_adjustments TO authenticated;
GRANT ALL ON public.payroll_adjustments TO service_role;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adjustments_read" ON public.payroll_adjustments FOR SELECT TO authenticated
  USING (public.is_payroll_manager(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.payroll p JOIN public.employees e ON e.id = p.employee_id
    WHERE p.id = payroll_id AND e.user_id = auth.uid()));
CREATE POLICY "adjustments_write" ON public.payroll_adjustments FOR ALL TO authenticated
  USING (public.is_payroll_manager(auth.uid())) WITH CHECK (public.is_payroll_manager(auth.uid()));
CREATE TRIGGER trg_adjustments_updated BEFORE UPDATE ON public.payroll_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ audit logs ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_payroll_manager(auth.uid()));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_payroll_manager(auth.uid()));