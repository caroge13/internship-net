-- Create user_job_applications table ONLY
-- Safe to run even if table already exists

CREATE TABLE IF NOT EXISTS public.user_job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Enable RLS (this will fail silently if already enabled, but that's okay)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_job_applications'
  ) THEN
    -- Table exists, just ensure RLS is enabled
    ALTER TABLE public.user_job_applications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_job_applications' AND policyname = 'Users can view their own applications'
  ) THEN
    CREATE POLICY "Users can view their own applications"
      ON public.user_job_applications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_job_applications' AND policyname = 'Users can insert their own applications'
  ) THEN
    CREATE POLICY "Users can insert their own applications"
      ON public.user_job_applications FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_job_applications' AND policyname = 'Users can delete their own applications'
  ) THEN
    CREATE POLICY "Users can delete their own applications"
      ON public.user_job_applications FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

