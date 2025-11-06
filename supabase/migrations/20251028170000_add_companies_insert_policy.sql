-- Allow authenticated users to insert new companies
-- This policy allows any authenticated user to insert companies into the public companies table
CREATE POLICY "Authenticated users can insert companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

