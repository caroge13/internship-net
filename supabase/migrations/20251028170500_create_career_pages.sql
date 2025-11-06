-- Map companies to their career page URLs and optional geography hints
CREATE TABLE IF NOT EXISTS public.career_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  geo_hints TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, url)
);

ALTER TABLE public.career_pages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read career pages (non-sensitive)
CREATE POLICY IF NOT EXISTS "Anyone can view career pages"
  ON public.career_pages FOR SELECT
  USING (true);

-- Allow users to manage career pages for companies they watch (simple rule: any authed can insert)
CREATE POLICY IF NOT EXISTS "Authenticated users can insert career pages"
  ON public.career_pages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can delete career pages"
  ON public.career_pages FOR DELETE
  TO authenticated
  USING (true);

