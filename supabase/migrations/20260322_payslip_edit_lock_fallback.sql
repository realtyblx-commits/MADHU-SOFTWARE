-- Fallback (no new enum): only admins can UPDATE/DELETE payslips (HR cannot).
-- Prefer 20260322_superadmin_payslip_edit.sql when you can add the superadmin enum.

DROP POLICY IF EXISTS "payslips_admin_write" ON public.payslips;
DROP POLICY IF EXISTS "payslips_manager_insert" ON public.payslips;
DROP POLICY IF EXISTS "payslips_superadmin_update" ON public.payslips;
DROP POLICY IF EXISTS "payslips_superadmin_delete" ON public.payslips;
DROP POLICY IF EXISTS "payslips_admin_update" ON public.payslips;
DROP POLICY IF EXISTS "payslips_admin_delete" ON public.payslips;

CREATE POLICY "payslips_manager_insert" ON public.payslips
  FOR INSERT TO authenticated
  WITH CHECK (public.is_payroll_manager(auth.uid()));

CREATE POLICY "payslips_admin_update" ON public.payslips
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "payslips_admin_delete" ON public.payslips
  FOR DELETE TO authenticated
  USING (public.is_admin());
