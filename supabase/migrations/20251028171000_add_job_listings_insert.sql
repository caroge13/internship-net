-- Allow authenticated users to insert job listings (for scraping)
CREATE POLICY "Authenticated users can insert job listings"
  ON public.job_listings FOR INSERT
  TO authenticated
  WITH CHECK (true);

