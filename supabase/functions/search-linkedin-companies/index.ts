// Supabase Edge Function - Search LinkedIn Companies
// Searches for companies on LinkedIn and returns results with logos

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get company logo from LinkedIn page or other sources
async function getCompanyLogo(companyName: string, linkedinUrl?: string): Promise<string | undefined> {
  // First, try to extract logo from LinkedIn page
  if (linkedinUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(linkedinUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        // Try to extract logo from LinkedIn page
        // LinkedIn stores logos in various formats
        const logoPatterns = [
          /<img[^>]*class="[^"]*org-top-card-logo[^"]*"[^>]*src="([^"]+)"/i,
          /<img[^>]*data-delayed-url="([^"]+logo[^"]+)"/i,
          /og:image["\s]*content=["']([^"']+)["']/i,
          /"logoUrl":"([^"]+)"/i,
        ];
        
        for (const pattern of logoPatterns) {
          const match = html.match(pattern);
          if (match && match[1] && !match[1].includes('placeholder')) {
            let logoUrl = match[1];
            // Convert relative URLs to absolute
            if (logoUrl.startsWith('//')) {
              logoUrl = 'https:' + logoUrl;
            } else if (logoUrl.startsWith('/')) {
              logoUrl = 'https://www.linkedin.com' + logoUrl;
            }
            return logoUrl;
          }
        }
      }
    } catch (e) {
      // LinkedIn fetch failed, try other sources
    }
  }
  
  // Fallback: Try Clearbit and other logo APIs
  const cleanName = companyName.toLowerCase().trim();
  const domains = [
    `${cleanName.replace(/\s+/g, '')}.com`,
    `www.${cleanName.replace(/\s+/g, '')}.com`,
    `${cleanName.replace(/[^a-z0-9]/g, '')}.com`,
    `${cleanName.replace(/[^a-z0-9]/g, '')}.io`,
    `${cleanName.replace(/[^a-z0-9]/g, '')}.ai`,
  ];
  
  // Try Clearbit Logo API
  for (const domain of domains) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`https://logo.clearbit.com/${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        return `https://logo.clearbit.com/${domain}`;
      }
    } catch (e) {
      continue;
    }
  }
  
  // Fallback: Google Favicon API (always works, but lower quality)
  return `https://www.google.com/s2/favicons?domain=${domains[0]}&sz=128`;
}

// Validate company exists on LinkedIn and get logo
async function validateCompanyAndGetLogo(companyName: string): Promise<{ linkedinUrl?: string; logoUrl?: string; exists: boolean; displayName?: string }> {
  // Generate multiple possible LinkedIn URL slugs
  const baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (!baseSlug) {
    return { exists: false };
  }
  
  // Try multiple slug variations
  const slugVariations = [
    baseSlug,
    baseSlug.replace(/-inc$/, ''),
    baseSlug.replace(/-llc$/, ''),
    baseSlug.replace(/-corp$/, ''),
    baseSlug.replace(/-corporation$/, ''),
    baseSlug.replace(/-video-communications$/, ''),
    baseSlug.replace(/-video-communications$/, '-video'),
  ];
  
  // Remove duplicates
  const uniqueSlugs = Array.from(new Set(slugVariations));
  
  // Try each slug variation
  for (const slug of uniqueSlugs) {
    const linkedinUrl = `https://www.linkedin.com/company/${slug}`;
    
    // Validate LinkedIn URL exists
    let linkedinExists = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(linkedinUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // Consider 200, 301, 302, 403 (forbidden but exists) as valid
      if (response.status === 200 || response.status === 301 || response.status === 302 || response.status === 403) {
        linkedinExists = true;
      }
    } catch (e) {
      // Validation failed, try next variation
      continue;
    }
    
    if (linkedinExists) {
      // Get logo from LinkedIn page
      const logoUrl = await getCompanyLogo(companyName, linkedinUrl);
      
      // Try to extract actual company name from LinkedIn page
      let displayName = companyName;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(linkedinUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const html = await response.text();
          // Try to extract company name from page title or meta tags
          const nameMatch = html.match(/<title>([^<]+)<\/title>/i) || 
                           html.match(/og:title["\s]*content=["']([^"']+)["']/i) ||
                           html.match(/"name":"([^"]+)"/i);
          if (nameMatch && nameMatch[1]) {
            displayName = nameMatch[1].replace(/\s*-\s*LinkedIn.*$/i, '').trim();
          }
        }
      } catch (e) {
        // Name extraction failed, use original name
      }
      
      return {
        linkedinUrl,
        logoUrl,
        exists: true,
        displayName,
      };
    }
  }
  
  return { exists: false };
}

// Search LinkedIn for companies matching a query
async function searchLinkedInCompanies(query: string): Promise<Array<{ name: string; logoUrl?: string; linkedinUrl: string }>> {
  const results: Array<{ name: string; logoUrl?: string; linkedinUrl: string }> = [];
  
  // Generate multiple company name variations to try
  const queryLower = query.toLowerCase().trim();
  const companyVariations = [
    query.trim(), // Exact match
    queryLower.replace(/\s+inc\.?$/i, '').trim(),
    queryLower.replace(/\s+llc\.?$/i, '').trim(),
    queryLower.replace(/\s+corp\.?$/i, '').trim(),
    queryLower.replace(/\s+corporation$/i, '').trim(),
    // Common tech company patterns
    queryLower + ' video communications',
    queryLower + ' technologies',
    queryLower + ' software',
    queryLower + ' systems',
  ];
  
  // Remove duplicates
  const uniqueVariations = Array.from(new Set(companyVariations.map(v => v.toLowerCase())));
  
  // Try each variation (limit to avoid too many requests)
  const variationsToTry = uniqueVariations.slice(0, 5);
  
  for (const variation of variationsToTry) {
    const result = await validateCompanyAndGetLogo(variation);
    if (result.exists && result.linkedinUrl) {
      // Check if we already have this company (by LinkedIn URL)
      const existing = results.find(r => r.linkedinUrl === result.linkedinUrl);
      if (!existing) {
        results.push({
          name: result.displayName || variation.charAt(0).toUpperCase() + variation.slice(1),
          logoUrl: result.logoUrl,
          linkedinUrl: result.linkedinUrl,
        });
      }
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

// @ts-ignore - Deno.serve exists at runtime
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = (await req.json()) as { query: string };

    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Query is required' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    // Search LinkedIn for companies matching the query
    const companies = await searchLinkedInCompanies(query.trim());

    return new Response(
      JSON.stringify({ 
        ok: true, 
        companies: companies,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? 'Unknown error' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }
});


