-- ====================================================================
-- BLX Realty Payroll — Storage Buckets + Strict RLS
-- Project: eccoqnsmbebmumxuhhkv
--
-- PUBLIC:
--   company-assets      — logos / authorized signatures (branding only)
--
-- PRIVATE (signed URL access only):
--   employee-photos     — passport / profile photographs
--   employee-kyc        — Aadhaar, PAN, bank passbook (highly sensitive)
--   employee-documents  — offer letters & other HR docs
--   payslips            — generated salary PDFs
-- ====================================================================

-- Ensure helper exists (idempotent with main schema)
CREATE OR REPLACE FUNCTION public.is_payroll_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'hr')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_code FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ---------- Buckets ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'company-assets',
    'company-assets',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  ),
  (
    'employee-photos',
    'employee-photos',
    false,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'employee-kyc',
    'employee-kyc',
    false,
    15728640,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  ),
  (
    'employee-documents',
    'employee-documents',
    false,
    15728640,
    ARRAY[
      'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'payslips',
    'payslips',
    false,
    20971520,
    ARRAY['application/pdf']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------- Drop legacy / prior storage policies for these buckets ----------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        policyname ILIKE '%company_assets%'
        OR policyname ILIKE '%employee_photos%'
        OR policyname ILIKE '%employee_kyc%'
        OR policyname ILIKE '%employee_documents%'
        OR policyname ILIKE '%payslips%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- ========== company-assets (PUBLIC read, manager write) ==========
CREATE POLICY "company_assets_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_manager_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND public.is_payroll_manager(auth.uid()));

CREATE POLICY "company_assets_manager_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_payroll_manager(auth.uid()));

CREATE POLICY "company_assets_manager_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_payroll_manager(auth.uid()));

-- ========== employee-photos (PRIVATE) ==========
-- Path: {employee_code}/{filename}
CREATE POLICY "employee_photos_manager_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'employee-photos' AND public.is_payroll_manager(auth.uid()))
  WITH CHECK (bucket_id = 'employee-photos' AND public.is_payroll_manager(auth.uid()));

CREATE POLICY "employee_photos_own_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_photos_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_photos_own_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_photos_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

-- ========== employee-kyc (PRIVATE — most sensitive) ==========
CREATE POLICY "employee_kyc_manager_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'employee-kyc' AND public.is_payroll_manager(auth.uid()))
  WITH CHECK (bucket_id = 'employee-kyc' AND public.is_payroll_manager(auth.uid()));

CREATE POLICY "employee_kyc_own_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-kyc'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_kyc_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-kyc'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_kyc_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-kyc'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

-- ========== employee-documents (PRIVATE) ==========
CREATE POLICY "employee_documents_manager_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'employee-documents' AND public.is_payroll_manager(auth.uid()))
  WITH CHECK (bucket_id = 'employee-documents' AND public.is_payroll_manager(auth.uid()));

CREATE POLICY "employee_documents_own_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_documents_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

CREATE POLICY "employee_documents_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.current_employee_code()
  );

-- ========== payslips (PRIVATE) ==========
-- Path: {year}/{MM}/{employee_code}/{payslip}.pdf
CREATE POLICY "payslips_manager_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payslips' AND public.is_payroll_manager(auth.uid()))
  WITH CHECK (bucket_id = 'payslips' AND public.is_payroll_manager(auth.uid()));

CREATE POLICY "payslips_own_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payslips'
    AND (storage.foldername(name))[3] = public.current_employee_code()
  );
