-- Superadmin role + payslip edit lock (UPDATE/DELETE = superadmin only)

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.is_payroll_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'hr', 'superadmin')
  );
$$;

-- First / requested admin also gets superadmin
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  role_count int;
  requested_role text;
BEGIN
  SELECT count(*) INTO role_count FROM public.user_roles;
  requested_role := NEW.raw_user_meta_data->>'role';

  IF requested_role IN ('admin', 'superadmin') OR role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'superadmin'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSIF requested_role = 'hr' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'hr'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Split payslip write policies
DROP POLICY IF EXISTS "payslips_admin_write" ON public.payslips;
DROP POLICY IF EXISTS "payslips_manager_insert" ON public.payslips;
DROP POLICY IF EXISTS "payslips_superadmin_update" ON public.payslips;
DROP POLICY IF EXISTS "payslips_superadmin_delete" ON public.payslips;

CREATE POLICY "payslips_manager_insert" ON public.payslips
  FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_manager(auth.uid()));

CREATE POLICY "payslips_superadmin_update" ON public.payslips
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "payslips_superadmin_delete" ON public.payslips
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

-- Allow viewers (who can read the slip) to update PDF storage metadata only
CREATE OR REPLACE FUNCTION public.touch_payslip_pdf_meta(
  p_id uuid,
  p_path text,
  p_size bigint DEFAULT NULL,
  p_generated_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.payslips
    WHERE id = p_id
      AND (
        public.is_payroll_manager(auth.uid())
        OR employee_id = public.get_current_employee_id()
      )
  ) THEN
    RAISE EXCEPTION 'Not allowed to update payslip PDF metadata';
  END IF;

  UPDATE public.payslips
  SET
    pdf_storage_path = p_path,
    pdf_file_size = COALESCE(p_size, pdf_file_size),
    pdf_generated_at = COALESCE(p_generated_at, now()),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_payslip_pdf_meta(uuid, text, bigint, timestamptz) TO authenticated;
