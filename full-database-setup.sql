-- ============================================
-- COMPLETE DATABASE SETUP FOR INTERN-SEEKER-PRO
-- Run this ONCE in your Supabase SQL Editor
-- This creates all tables and policies needed
-- ============================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 2. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  values_culture TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Anyone can view companies'
  ) THEN
    CREATE POLICY "Anyone can view companies"
      ON public.companies FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Authenticated users can insert companies'
  ) THEN
    CREATE POLICY "Authenticated users can insert companies"
      ON public.companies FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 3. USER WATCHLIST TABLE
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_watchlist' AND policyname = 'Users can view their own watchlist'
  ) THEN
    CREATE POLICY "Users can view their own watchlist"
      ON public.user_watchlist FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_watchlist' AND policyname = 'Users can add to their watchlist'
  ) THEN
    CREATE POLICY "Users can add to their watchlist"
      ON public.user_watchlist FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_watchlist' AND policyname = 'Users can remove from their watchlist'
  ) THEN
    CREATE POLICY "Users can remove from their watchlist"
      ON public.user_watchlist FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. JOB LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.job_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  post_date DATE NOT NULL,
  due_date DATE,
  is_rolling BOOLEAN DEFAULT false,
  acceptance_rate NUMERIC(5,2),
  key_skills TEXT[],
  visa_sponsorship BOOLEAN DEFAULT false,
  location TEXT,
  job_type TEXT DEFAULT 'Internship',
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_listings' AND policyname = 'Anyone can view job listings'
  ) THEN
    CREATE POLICY "Anyone can view job listings"
      ON public.job_listings FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_listings' AND policyname = 'Authenticated users can insert job listings'
  ) THEN
    CREATE POLICY "Authenticated users can insert job listings"
      ON public.job_listings FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 5. JOB ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.job_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_frequency TEXT NOT NULL DEFAULT 'daily',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_alerts' AND policyname = 'Users can view their own alerts'
  ) THEN
    CREATE POLICY "Users can view their own alerts"
      ON public.job_alerts FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_alerts' AND policyname = 'Users can create alerts'
  ) THEN
    CREATE POLICY "Users can create alerts"
      ON public.job_alerts FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_alerts' AND policyname = 'Users can update their alerts'
  ) THEN
    CREATE POLICY "Users can update their alerts"
      ON public.job_alerts FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_alerts' AND policyname = 'Users can delete their alerts'
  ) THEN
    CREATE POLICY "Users can delete their alerts"
      ON public.job_alerts FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. CAREER PAGES TABLE
CREATE TABLE IF NOT EXISTS public.career_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  geo_hints TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, url)
);

ALTER TABLE public.career_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'career_pages' AND policyname = 'Anyone can view career pages'
  ) THEN
    CREATE POLICY "Anyone can view career pages"
      ON public.career_pages FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'career_pages' AND policyname = 'Authenticated users can insert career pages'
  ) THEN
    CREATE POLICY "Authenticated users can insert career pages"
      ON public.career_pages FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'career_pages' AND policyname = 'Authenticated users can delete career pages'
  ) THEN
    CREATE POLICY "Authenticated users can delete career pages"
      ON public.career_pages FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================
-- DONE! Your database is now fully set up
-- ============================================

