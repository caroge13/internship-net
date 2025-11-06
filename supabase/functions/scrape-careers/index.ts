// Supabase Edge Function (Deno) - Scrape company career pages
// Deploy with: supabase functions deploy scrape-careers
//
// ⚠️ NOTE: TypeScript errors here are EXPECTED. This is Deno code, not Node.js.
// Your IDE may show errors because it's configured for Node.js TypeScript.
// These functions run in Supabase's Deno runtime and work fine when deployed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JobInput = {
  companyIds?: string[];
  geographies?: string[]; // e.g., ["Canada", "US-East", "Toronto", "Remote"]
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getClient() {
  // @ts-ignore - Deno global exists at runtime
  const url = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore - Deno global exists at runtime
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Use service role for database operations (bypasses RLS)
  return createClient(url, serviceKey);
}

async function listTargets(supabase: ReturnType<typeof createClient>, companyIds?: string[]) {
  // First, try to get career pages from the database
  const baseQuery = supabase
    .from('career_pages')
    .select('company_id, url, companies(name, website)');
  const query = companyIds && companyIds.length > 0 ? baseQuery.in('company_id', companyIds) : baseQuery;
  const { data: careerPages, error: careerError } = await query;
  
  // If we have career pages, return them
  if (careerPages && careerPages.length > 0) {
    return careerPages;
  }
  
  // If no career pages exist, create default URLs for companies
  if (companyIds && companyIds.length > 0) {
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, website')
      .in('id', companyIds);
    
    if (companiesError) throw companiesError;
    
    // Generate default career page URLs for companies without career pages
    // Try multiple common patterns
    const defaultUrls: any[] = [];
    
    for (const c of companies || []) {
      const companyName = (c.name || '').toLowerCase().replace(/\s+/g, '');
      let careerUrl = '';
      
      // Check if website exists and is NOT a Wikipedia URL
      if (c.website && !c.website.includes('wikipedia.org')) {
        // Use actual company website
        const baseUrl = c.website.replace(/\/$/, '').replace(/\/wiki\/.*$/, ''); // Remove any wiki paths
        careerUrl = `${baseUrl}/careers`;
      } else {
        // Generate URLs from company name (common patterns)
        // Handle special cases for well-known companies
        const specialCases: Record<string, string> = {
          'amazon': 'https://www.amazon.jobs',
          'google': 'https://careers.google.com',
          'microsoft': 'https://careers.microsoft.com',
          'apple': 'https://jobs.apple.com',
          'meta': 'https://www.metacareers.com',
          'facebook': 'https://www.metacareers.com',
          'netflix': 'https://jobs.netflix.com',
          'spotify': 'https://www.lifeatspotify.com',
          'salesforce': 'https://www.salesforce.com/careers',
          'adobe': 'https://careers.adobe.com',
          'oracle': 'https://www.oracle.com/careers',
          'ibm': 'https://www.ibm.com/careers',
          'intel': 'https://www.intel.com/content/www/us/en/jobs',
          'nvidia': 'https://www.nvidia.com/en-us/about-nvidia/careers',
          'shopify': 'https://www.shopify.com/careers',
          'stripe': 'https://stripe.com/jobs',
          'airbnb': 'https://careers.airbnb.com',
          'uber': 'https://www.uber.com/careers',
          'tesla': 'https://www.tesla.com/careers',
        };
        
        const lowerName = companyName.toLowerCase();
        if (specialCases[lowerName]) {
          careerUrl = specialCases[lowerName];
        } else {
          // Try common patterns
          const possibleUrls = [
            `https://${companyName}.com/careers`,
            `https://www.${companyName}.com/careers`,
            `https://${companyName}.com/jobs`,
            `https://www.${companyName}.com/jobs`,
            `https://careers.${companyName}.com`,
            `https://jobs.${companyName}.com`,
          ];
          careerUrl = possibleUrls[0]; // Use first as default
        }
      }
      
      defaultUrls.push({
        company_id: c.id,
        url: careerUrl,
        companies: { name: c.name, website: c.website }
      });
    }
    
    return defaultUrls;
  }
  
  return [];
}

// Real scraper: fetches and parses job listings from company career pages
async function scrapeCareers(url: string, companyName: string, geographies?: string[]) {
  try {
    console.log(`Scraping careers for ${companyName} from ${url}`);
    
    // Try multiple URL patterns if the first fails
    const urlPatterns = [url];
    if (url.includes('/careers')) {
      urlPatterns.push(url.replace('/careers', '/jobs'));
      urlPatterns.push(url.replace('/careers', '/careers/en-us'));
    }
    
    let html = '';
    let successfulUrl = '';
    
    for (const tryUrl of urlPatterns) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (response.ok) {
          html = await response.text();
          successfulUrl = tryUrl;
          console.log(`Successfully fetched from ${tryUrl} (${html.length} chars)`);
          break;
        } else {
          console.log(`Failed to fetch ${tryUrl}: ${response.status}`);
        }
      } catch (e) {
        console.log(`Error fetching ${tryUrl}:`, e);
        continue;
      }
    }
    
    if (!html) {
      console.error(`Failed to fetch any URL for ${companyName}`);
      return [];
    }
    
    const jobs: any[] = [];
    const finalUrl = successfulUrl || url;
    
    // ALWAYS try JSON-LD structured data first (most reliable for titles)
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const scriptContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const jsonLd = JSON.parse(scriptContent);
          if (Array.isArray(jsonLd)) {
            for (const item of jsonLd) {
              if (item['@type'] === 'JobPosting' && item.title && item.title.toLowerCase().includes('intern')) {
                // Avoid duplicates
                if (!jobs.some(j => j.url === (item.url || finalUrl) && j.title.toLowerCase() === item.title.toLowerCase())) {
                  jobs.push({
                  title: item.title.trim(),
                  description: item.description || '',
                  post_date: item.datePosted ? new Date(item.datePosted).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
                  due_date: item.validThrough ? new Date(item.validThrough).toISOString().substring(0, 10) : null,
                  is_rolling: !item.validThrough,
                  acceptance_rate: null, // Will be fetched separately
                  key_skills: extractSkills(item.description || ''),
                  visa_sponsorship: extractVisaSponsorship(item.description || '', html),
                  location: item.jobLocation?.address?.addressLocality || 
                           item.jobLocation?.address?.addressRegion || 
                           extractLocation(item.description || '', html, geographies),
                  term: extractTerm(item.description || item.title),
                  url: item.url || finalUrl,
                  });
                }
              }
            }
          } else if (jsonLd['@type'] === 'JobPosting' && jsonLd.title && jsonLd.title.toLowerCase().includes('intern')) {
            // Avoid duplicates
            if (!jobs.some(j => j.url === (jsonLd.url || finalUrl) && j.title.toLowerCase() === jsonLd.title.toLowerCase())) {
              jobs.push({
                title: jsonLd.title.trim(),
                description: jsonLd.description || '',
                post_date: jsonLd.datePosted ? new Date(jsonLd.datePosted).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
                due_date: jsonLd.validThrough ? new Date(jsonLd.validThrough).toISOString().substring(0, 10) : null,
                is_rolling: !jsonLd.validThrough,
                acceptance_rate: null, // Will be fetched separately
                key_skills: extractSkills(jsonLd.description || ''),
                visa_sponsorship: extractVisaSponsorship(jsonLd.description || '', html),
                location: jsonLd.jobLocation?.address?.addressLocality || 
                         jsonLd.jobLocation?.address?.addressRegion ||
                         extractLocation(jsonLd.description || '', html, geographies),
                term: extractTerm(jsonLd.description || jsonLd.title),
                url: jsonLd.url || finalUrl,
              });
            }
          }
        } catch (e) {
          // Skip invalid JSON-LD
        }
      }
    }
    
    // Detect the job board platform and parse accordingly (only if JSON-LD didn't find jobs)
    if (jobs.length === 0) {
      if (finalUrl.includes('workday.com')) {
        // Workday boards - usually have JSON data embedded
        const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            // Parse Workday job listings from the JSON structure
            // This is a simplified parser - actual structure varies
            if (data.jobPostings) {
              for (const job of data.jobPostings) {
                // Strictly filter for internships only
                const title = (job.title || '').toLowerCase();
                if (title.includes('intern') || title.includes('internship')) {
                  jobs.push({
                    title: job.title,
                    description: (job.description || '').substring(0, 1000),
                    post_date: job.postedOn || new Date().toISOString().substring(0, 10),
                    due_date: job.endDate || null,
                    is_rolling: !job.endDate,
                    acceptance_rate: null, // Will be fetched separately
                    key_skills: extractSkills(job.description || ''),
                    visa_sponsorship: extractVisaSponsorship(job.description || '', html),
                    location: job.location || extractLocation(job.description || '', html, geographies),
                    term: extractTerm(job.description || job.title),
                    url: job.externalUrl || finalUrl,
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error parsing Workday JSON:', e);
          }
        }
      } else if (finalUrl.includes('greenhouse.io') || finalUrl.includes('boards.greenhouse.io')) {
        // Greenhouse boards - usually have structured data
        const scriptMatch = html.match(/<script[^>]*id="initial-state"[^>]*>(.+?)<\/script>/s);
        if (scriptMatch) {
          try {
            const data = JSON.parse(scriptMatch[1]);
            if (data.jobs) {
              for (const job of data.jobs) {
                // Strictly filter for internships only
                const title = (job.title || '').toLowerCase();
                if (title.includes('intern') || title.includes('internship')) {
                  jobs.push({
                    title: job.title,
                    description: (job.content || '').substring(0, 1000),
                    post_date: job.updated_at ? new Date(job.updated_at).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
                    due_date: null,
                    is_rolling: true,
                    acceptance_rate: null, // Will be fetched separately
                    key_skills: extractSkills(job.content || ''),
                    visa_sponsorship: extractVisaSponsorship(job.content || '', html),
                    location: job.location?.name || extractLocation(job.content || '', html, geographies),
                    term: extractTerm(job.content || job.title),
                    url: job.absolute_url || finalUrl,
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error parsing Greenhouse data:', e);
          }
        }
      } else {
      // Generic HTML parsing - look for common patterns
      // Improved parsing for various job board formats
      
      // First, try to find job listings in structured formats
      // Look for data attributes or structured job containers
      const jobContainerPatterns = [
        /<div[^>]*data-job-id[^>]*>[\s\S]*?<\/div>/gi,
        /<div[^>]*class=["'][^"']*job[^"']*-?listing[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        /<div[^>]*class=["'][^"']*job[^"']*-?item[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        /<div[^>]*class=["'][^"']*position[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        /<article[^>]*class=["'][^"']*job[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
        /<li[^>]*class=["'][^"']*job[^"']*["'][^>]*>[\s\S]*?<\/li>/gi,
      ];
      
      let matches: string[] = [];
      for (const pattern of jobContainerPatterns) {
        const found = html.match(pattern);
        if (found) {
          matches = found;
          break;
        }
      }
      
      // If no structured containers found, fall back to generic pattern
      if (matches.length === 0) {
        matches = html.match(/<div[^>]*class=["'][^"']*job[^"']*["'][^>]*>[\s\S]*?<\/div>/gi) || [];
      }
      
      for (const match of matches.slice(0, 50)) { // Increase limit
        // Try multiple patterns to extract job title - prioritize more specific patterns
        const titlePatterns = [
          // Most specific: data attributes
          /data-job-title=["']([^"']+)["']/i,
          /data-title=["']([^"']*intern[^"']+)["']/i,
          // Heading with job/intern in class or content
          /<h[123][^>]*class=["'][^"']*(?:job|position|title)[^"']*["'][^>]*>([^<]*intern[^<]*)<\/h[123]>/i,
          /<h[123][^>]*>([^<]*intern[^<]*)<\/h[123]>/i,
          // Link with job title class
          /<a[^>]*class=["'][^"']*(?:job|position|title)[^"']*["'][^>]*href=["'][^"']*job[^"']*["'][^>]*>([^<]*intern[^<]*)<\/a>/i,
          /<a[^>]*href=["'][^"']*job[^"']*["'][^>]*>([^<]*intern[^<]*)<\/a>/i,
          // Span with title class
          /<span[^>]*class=["'][^"']*(?:job|position|title)[^"']*["'][^>]*>([^<]*intern[^<]*)<\/span>/i,
          // Generic title attribute (less reliable)
          /title=["']([^"']*intern[^"']+)["']/i,
        ];
        
        let title = '';
        for (const pattern of titlePatterns) {
          const titleMatch = match.match(pattern);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim().replace(/\s+/g, ' ');
            // Filter out generic titles and ensure it's a valid job title
            const lowerTitle = title.toLowerCase();
            const invalidPatterns = [
              /^(career|job|search|view|apply|internal|site|page|home|about|contact)/i,
              /career\s*site/i,
              /job\s*board/i,
              /apply\s*now/i,
              /view\s*details/i,
            ];
            
            const isValid = lowerTitle.includes('intern') && 
                          lowerTitle.length > 5 && 
                          lowerTitle.length < 100 &&
                          !invalidPatterns.some(pattern => pattern.test(lowerTitle));
            
            if (isValid) {
              break;
            } else {
              title = ''; // Reset if invalid
            }
          }
        }
        
        if (!title || !title.toLowerCase().includes('intern')) continue;
        
        // Extract description - try multiple patterns
        let description = '';
        const descPatterns = [
          /<p[^>]*class=["'][^"']*description[^"']*["'][^>]*>([^<]+)<\/p>/i,
          /<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([^<]+)<\/div>/i,
          /<p[^>]*>([^<]{20,200})<\/p>/i,
        ];
        
        for (const pattern of descPatterns) {
          const descMatch = match.match(pattern);
          if (descMatch && descMatch[1]) {
            description = descMatch[1].trim();
            break;
          }
        }
        
        // Extract location - improved extraction
        let location = extractLocation(match + description, html, geographies);
        
        // Extract visa sponsorship - improved detection
        const visaSponsorship = extractVisaSponsorship(match + description, html);
        
        // Extract URL
        let jobUrl = finalUrl;
        const urlPatterns = [
          /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?intern[\s\S]*?<\/a>/i,
          /href=["']([^"']*job[^"']*intern[^"']*)["']/i,
          /href=["']([^"']*intern[^"']*job[^"']*)["']/i,
        ];
        
        for (const pattern of urlPatterns) {
          const urlMatch = match.match(pattern);
          if (urlMatch && urlMatch[1]) {
            const href = urlMatch[1];
            jobUrl = href.startsWith('http') ? href : new URL(href, finalUrl).toString();
            break;
          }
        }
        
        jobs.push({
          title,
          description: description || '',
          post_date: new Date().toISOString().substring(0, 10),
          due_date: null,
          is_rolling: true,
          acceptance_rate: null, // Will be fetched separately
          key_skills: extractSkills(match + description),
          visa_sponsorship: visaSponsorship,
          location: location,
          term: extractTerm(title + description),
          url: jobUrl,
        });
      }
        
      // Try to find links with "intern" in the text as last resort (only if no jobs found yet)
      if (jobs.length === 0) {
        const linkMatches = html.match(/<a[^>]*href=["']([^"']*(?:job[^"']*intern[^"']*|intern[^"']*))["'][^>]*>([^<]*intern[^<]*)<\/a>/gi);
        if (linkMatches) {
          for (const match of linkMatches.slice(0, 30)) {
            const hrefMatch = match.match(/href=["']([^"']+)["']/i);
            const textMatch = match.match(/>([^<]*intern[^<]*)</i);
            if (hrefMatch && textMatch) {
              const title = textMatch[1].trim().replace(/\s+/g, ' ');
              // Filter out generic links more strictly
              const lowerTitle = title.toLowerCase();
              const invalidPatterns = [
                /^(career|job|search|view|apply|internal|site|page|home|about|contact)/i,
                /career\s*site/i,
                /job\s*board/i,
                /apply\s*now/i,
                /view\s*details/i,
                /learn\s*more/i,
              ];
              
              const isValid = lowerTitle.includes('intern') && 
                            lowerTitle.length > 5 &&
                            lowerTitle.length < 100 &&
                            !invalidPatterns.some(pattern => pattern.test(lowerTitle));
              
              if (isValid) {
                const jobUrl = hrefMatch[1].startsWith('http') ? hrefMatch[1] : new URL(hrefMatch[1], successfulUrl || url).toString();
                
                // Avoid duplicates
                if (!jobs.some(j => j.url === jobUrl && j.title.toLowerCase() === title.toLowerCase())) {
                  jobs.push({
                    title,
                    description: '',
                    post_date: new Date().toISOString().substring(0, 10),
                    due_date: null,
                    is_rolling: true,
                    acceptance_rate: null, // Will be fetched separately
                    key_skills: [],
                    visa_sponsorship: extractVisaSponsorship('', html),
                    location: extractLocation('', html, geographies),
                    term: extractTerm(title),
                    url: jobUrl,
                  });
                }
              }
            }
          }
        }
      }
    }
    }
    
    // After collecting all jobs, fetch acceptance rates for each (if URL is available)
    for (const job of jobs) {
      if (job.url && !job.acceptance_rate) {
        try {
          const rate = await extractAcceptanceRate(job.url, job.description || '', companyName);
          if (rate !== null) {
            job.acceptance_rate = rate;
          }
        } catch (e) {
          // Continue if acceptance rate fetch fails
          console.log(`Failed to fetch acceptance rate for ${job.url}:`, e);
        }
      }
    }
    
    console.log(`Found ${jobs.length} internship jobs for ${companyName}`);
    return jobs;
  } catch (e) {
    console.error(`Error scraping ${url}:`, e);
    return [];
  }
}

// Extract location from text/HTML more robustly
function extractLocation(text: string, html: string, geographies?: string[]): string {
  // Try JSON-LD location first if available
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1].replace(/<script[^>]*>/i, '').replace(/<\/script>/i, ''));
      if (jsonLd.jobLocation?.address) {
        const loc = jsonLd.jobLocation.address.addressLocality || jsonLd.jobLocation.address.addressRegion || jsonLd.jobLocation.address.addressCountry;
        if (loc) return loc;
      }
    } catch (e) {
      // Continue to other methods
    }
  }
  
  // Look for location patterns in HTML
  const locationPatterns = [
    /location[:\s]*["']?([^"',\n<]+)["']?/i,
    /<span[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]+)<\/span>/i,
    /<div[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]+)<\/div>/i,
    /<p[^>]*class=["'][^"']*location[^"']*["'][^>]*>([^<]+)<\/p>/i,
    /data-location=["']([^"']+)["']/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = html.match(pattern) || text.match(pattern);
    if (match && match[1]) {
      const loc = match[1].trim();
      if (loc.length > 0 && loc.length < 100 && !loc.toLowerCase().includes('location')) {
        return loc;
      }
    }
  }
  
  // Look for common city/country patterns
  const cityCountryPattern = /(?:in|at|located in|based in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*,\s*[A-Z][a-z]+)?)/i;
  const cityMatch = text.match(cityCountryPattern);
  if (cityMatch && cityMatch[1]) {
    return cityMatch[1].trim();
  }
  
  return geographies?.[0] || 'Location not specified';
}

// Extract visa sponsorship more robustly
function extractVisaSponsorship(text: string, html: string): boolean {
  const lowerText = (text + ' ' + html).toLowerCase();
  
  // Positive indicators
  const positivePatterns = [
    /visa\s+sponsorship/i,
    /sponsor\s+visa/i,
    /work\s+authorization\s+sponsorship/i,
    /eligible\s+for\s+visa/i,
    /we\s+sponsor\s+visas/i,
    /will\s+sponsor/i,
    /sponsorship\s+available/i,
    /h1b\s+sponsorship/i,
    /tn\s+visa/i,
    /eligible\s+for\s+work\s+authorization/i,
  ];
  
  // Negative indicators (explicitly says no sponsorship)
  const negativePatterns = [
    /no\s+visa\s+sponsorship/i,
    /do\s+not\s+sponsor/i,
    /cannot\s+sponsor/i,
    /unable\s+to\s+sponsor/i,
    /must\s+have\s+authorization/i,
    /must\s+be\s+authorized/i,
    /u\.?s\.?\s+citizen/i,
    /permanent\s+resident/i,
  ];
  
  // Check negative first
  for (const pattern of negativePatterns) {
    if (pattern.test(lowerText)) {
      return false;
    }
  }
  
  // Check positive
  for (const pattern of positivePatterns) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }
  
  return false;
}

// Extract acceptance rate from LinkedIn job page or other sources
async function extractAcceptanceRate(jobUrl: string, description: string, companyName: string): Promise<number | null> {
  // Try to find acceptance rate in description first
  const ratePatterns = [
    /acceptance\s*rate[:\s]*(\d+\.?\d*)%/i,
    /(\d+\.?\d*)%\s*acceptance/i,
    /(\d+)\s*out\s*of\s*(\d+)\s*applicants/i,
    /(\d+)\s*selected\s*from\s*(\d+)/i,
  ];
  
  for (const pattern of ratePatterns) {
    const match = description.match(pattern);
    if (match) {
      if (match[2]) {
        // Two numbers: selected / applicants
        const selected = parseFloat(match[1]);
        const applicants = parseFloat(match[2]);
        if (applicants > 0 && selected <= applicants) {
          return Math.round((selected / applicants) * 100 * 100) / 100;
        }
      } else if (match[1]) {
        // Single percentage
        const rate = parseFloat(match[1]);
        if (rate > 0 && rate <= 100) {
          return rate;
        }
      }
    }
  }
  
  // Try scraping from LinkedIn if it's a LinkedIn URL
  if (jobUrl.includes('linkedin.com/jobs')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(jobUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        // LinkedIn shows applicant counts like "X applicants" or "X applicants (Y% of applicants)"
        const applicantMatch = html.match(/(\d+)\s*applicants?/i);
        // We can't easily get acceptance rate from LinkedIn without knowing hires
        // But we can try to find if there's any acceptance rate mentioned
        const rateMatch = html.match(/(\d+\.?\d*)%\s*acceptance/i) || html.match(/acceptance[:\s]*(\d+\.?\d*)%/i);
        if (rateMatch && rateMatch[1]) {
          const rate = parseFloat(rateMatch[1]);
          if (rate > 0 && rate <= 100) {
            return rate;
          }
        }
      }
    } catch (e) {
      // LinkedIn scraping failed, continue
    }
  }
  
  // Try searching Glassdoor for company interview statistics (future enhancement)
  // For now, return null
  
  return null;
}

// Extract skills from text
function extractSkills(text: string): string[] {
  const commonSkills = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'Git'];
  const found: string[] = [];
  for (const skill of commonSkills) {
    if (text.toLowerCase().includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }
  return found.slice(0, 5); // Limit to 5 skills
}

// Extract term from text (e.g., "Summer 2026", "Jan 2026 - Aug 2026")
function extractTerm(text: string): string | null {
  const termMatch = text.match(/((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i) ||
                    text.match(/(summer|fall|winter|spring)\s+\d{4}/i) ||
                    text.match(/(\d{4}\s*-\s*\d{4})/);
  return termMatch ? termMatch[1] : null;
}

async function upsertJobs(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  jobs: any[],
) {
  if (jobs.length === 0) {
    console.log(`No jobs to insert for company ${companyId}`);
    return;
  }
  
  console.log(`Inserting ${jobs.length} jobs for company ${companyId}`);
  
  // Filter out jobs with invalid titles (like "internal career site")
  const validJobs = jobs.filter(j => {
    const title = (j.title || '').toLowerCase().trim();
    const invalidTitles = ['internal career site', 'career site', 'view jobs', 'search jobs', 'careers', 'jobs'];
    return title.length > 3 && !invalidTitles.includes(title) && title.includes('intern');
  });
  
  console.log(`Filtered to ${validJobs.length} valid internship jobs`);
  
  const rows = validJobs.map((j) => ({ 
    company_id: companyId, 
    title: j.title.trim(), 
    post_date: j.post_date,
    key_skills: j.key_skills || [],
    description: (j.description || '').substring(0, 1000), // Limit description length
    due_date: j.due_date || null,
    is_rolling: j.is_rolling ?? true,
    acceptance_rate: j.acceptance_rate || null,
    visa_sponsorship: j.visa_sponsorship || false,
    location: j.location || 'Remote',
    term: j.term || null,
    url: j.url || null,
  }));
  
  // Use upsert to prevent duplicates based on company_id + title + url
  // First, try to insert each job individually to handle duplicates gracefully
  let inserted = 0;
  let skipped = 0;
  
  for (const row of rows) {
    // Check if job already exists
    const { data: existing } = await supabase
      .from('job_listings')
      .select('id')
      .eq('company_id', row.company_id)
      .eq('title', row.title)
      .eq('url', row.url || '')
      .maybeSingle();
    
    if (existing) {
      skipped++;
      continue;
    }
    
    const { error } = await supabase
      .from('job_listings')
      .insert(row);
    
    if (error) {
      if ((error as any).code === '23505') {
        skipped++;
      } else {
        console.error('Error inserting job:', error, row);
      }
    } else {
      inserted++;
    }
  }
  
  console.log(`Inserted ${inserted} new jobs, skipped ${skipped} duplicates`);
}

// @ts-ignore - Deno.serve exists at runtime
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getClient();
    const body = (await req.json().catch(() => ({}))) as JobInput;
    
    console.log("=== SCRAPE CAREERS FUNCTION CALLED ===");
    console.log("Company IDs:", body.companyIds);
    console.log("Geographies:", body.geographies);
    
    const targets = await listTargets(supabase, body.companyIds);
    console.log(`Found ${targets.length} targets to scrape`);

    if (targets.length === 0) {
      console.log("No targets found - returning early");
      return new Response(JSON.stringify({ ok: true, totalInserted: 0, message: "No companies or career pages found" }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      });
    }

    let totalInserted = 0;
    for (const t of targets) {
      const companyId = t.company_id as string;
      const companyName = t.companies?.name as string;
      const url = t.url as string;
      console.log(`\n=== Processing ${companyName} (${companyId}) ===`);
      console.log(`URL: ${url}`);
      
      const jobs = await scrapeCareers(url, companyName, body.geographies);
      console.log(`Found ${jobs.length} jobs for ${companyName}`);
      
      if (jobs.length > 0) {
        console.log(`Sample job titles:`, jobs.slice(0, 3).map(j => j.title));
        await upsertJobs(supabase, companyId, jobs);
        totalInserted += jobs.length;
      } else {
        console.log(`No jobs found for ${companyName} - URL might be incorrect or page structure different`);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total jobs inserted: ${totalInserted}`);
    console.log(`Processed ${targets.length} companies`);
    
    return new Response(JSON.stringify({ ok: true, totalInserted, companiesProcessed: targets.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Unknown error' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    });
  }
});


