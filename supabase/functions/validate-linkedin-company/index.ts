// Supabase Edge Function - Validate LinkedIn Company Existence
// Checks if a company page exists on LinkedIn

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate if a company exists on LinkedIn
async function validateLinkedInCompany(companyName: string): Promise<boolean> {
  try {
    // Try to access LinkedIn company page
    // LinkedIn company URLs typically follow: linkedin.com/company/{company-name}
    // We'll try a few variations
    const companySlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const possibleUrls = [
      `https://www.linkedin.com/company/${companySlug}`,
      `https://www.linkedin.com/company/${companySlug.toLowerCase().replace(/\s+/g, '')}`,
      `https://www.linkedin.com/company/${encodeURIComponent(companyName.toLowerCase().replace(/\s+/g, '-'))}`,
    ];

    for (const url of possibleUrls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          redirect: 'follow',
        });

        // LinkedIn returns 200 for valid company pages, 404 for invalid
        // Sometimes returns 301/302 redirects for valid pages
        if (response.ok || response.status === 301 || response.status === 302) {
          // Double-check by fetching the page and checking for company indicators
          const pageResponse = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            // Check for LinkedIn company page indicators
            if (html.includes('company/') || html.includes('"company"') || html.includes('entityType":"company"')) {
              return true;
            }
          }
        }
      } catch (e) {
        // Try next URL
        continue;
      }
    }

    return false;
  } catch (e) {
    console.error('Error validating LinkedIn company:', e);
    return false;
  }
}

// @ts-ignore - Deno.serve exists at runtime
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { companyName } = (await req.json()) as { companyName: string };

    if (!companyName || !companyName.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Company name is required' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    const isValid = await validateLinkedInCompany(companyName.trim());

    return new Response(
      JSON.stringify({ ok: true, exists: isValid, companyName: companyName.trim() }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? 'Unknown error' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }
});

