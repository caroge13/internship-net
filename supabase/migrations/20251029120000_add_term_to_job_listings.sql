-- Add term column to job_listings for internship term windows (e.g., Jan2026-Aug2026)
ALTER TABLE public.job_listings
ADD COLUMN IF NOT EXISTS term TEXT;


