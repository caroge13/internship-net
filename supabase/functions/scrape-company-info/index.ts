// Supabase Edge Function - Scrape company information from online sources
// This fetches company descriptions, industry, and other details

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getClient() {
  // @ts-ignore - Deno global exists at runtime
  const url = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore - Deno global exists at runtime
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey);
}

// Scrape company info from Wikipedia
async function getCompanyInfoFromWikipedia(companyName: string) {
  try {
    // Clean company name for Wikipedia URL
    const wikiName = companyName.replace(/\s+/g, '_');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      description: data.extract || null,
      // Don't use Wikipedia URL as website - it's not the company's actual website
      website: null,
    };
  } catch (e) {
    console.error('Wikipedia fetch error:', e);
    return null;
  }
}

// Scrape company info from company website (try to find About page)
async function getCompanyInfoFromWebsite(companyName: string) {
  try {
    // Try common domain patterns
    const domain = companyName.toLowerCase().replace(/\s+/g, '');
    const possibleUrls = [
      `https://${domain}.com/about`,
      `https://www.${domain}.com/about`,
      `https://${domain}.com`,
      `https://www.${domain}.com`,
    ];
    
    for (const url of possibleUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          // Extract meta description or first paragraph
          const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
          if (metaMatch) {
            return {
              description: metaMatch[1],
              website: url.replace('/about', ''),
            };
          }
          
          // Try to extract from Open Graph description
          const ogMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
          if (ogMatch) {
            return {
              description: ogMatch[1],
              website: url.replace('/about', ''),
            };
          }
        }
      } catch (e) {
        // Try next URL
        continue;
      }
    }
    
    return null;
  } catch (e) {
    console.error('Website fetch error:', e);
    return null;
  }
}

// @ts-ignore - Deno.serve exists at runtime
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getClient();
    const { companyId, companyName } = (await req.json()) as { companyId: string; companyName: string };

    if (!companyId || !companyName) {
      return new Response(
        JSON.stringify({ ok: false, error: 'companyId and companyName are required' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    // Try Wikipedia first
    let companyInfo = await getCompanyInfoFromWikipedia(companyName);
    
    // If Wikipedia fails, try company website
    if (!companyInfo || !companyInfo.description) {
      companyInfo = await getCompanyInfoFromWebsite(companyName);
    }
    
    // Update company with scraped info
    if (companyInfo) {
      const updateData: any = {};
      if (companyInfo.description) {
        updateData.description = companyInfo.description.substring(0, 500); // Limit length
      }
      // Only update website if it's NOT a Wikipedia URL
      if (companyInfo.website && !companyInfo.website.includes('wikipedia.org')) {
        updateData.website = companyInfo.website;
      }
      
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(updateData)
          .eq('id', companyId);
        
        if (updateError) {
          console.error('Error updating company:', updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, companyInfo }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? 'Unknown error' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }
});

