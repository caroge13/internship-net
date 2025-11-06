# Scrape Careers Edge Function

This is a Supabase Edge Function written in Deno (not Node.js).

## About the "Errors"

The TypeScript errors you see in your IDE are **expected**. This is Deno code that runs in a different runtime than your main application (which uses Node.js/Vite).

## To Deploy

```bash
supabase functions deploy scrape-careers
```

## To Test Locally

```bash
supabase functions serve scrape-careers
```

The errors you see are normal because:
- Your IDE is configured for Node.js TypeScript
- This code runs in Deno runtime (different environment)
- They will work fine when deployed to Supabase

## Current Status

This is currently a **stub** implementation that returns mock data. To implement real scraping:

1. Add real HTTP fetching to company career pages
2. Parse Workday/Greenhouse/Lever job boards
3. Extract actual job data
4. Filter by geography if needed

