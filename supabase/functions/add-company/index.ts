// Supabase Edge Function - Add company (bypasses RLS using service role)
// This allows authenticated users to add companies to the database

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore - Deno global exists at runtime
function getClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!;
  // Use anon key for user context, but we'll use service role for the actual insert
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Client with user context (for auth check)
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  
  // Service role client (bypasses RLS)
  const serviceClient = createClient(url, serviceKey);
  
  return { userClient, serviceClient };
}

// @ts-ignore - Deno.serve exists at runtime
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userClient, serviceClient } = getClient(req);
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Authentication required' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 401 }
      );
    }

    const { companyName, logoUrl } = (await req.json()) as { companyName: string; logoUrl?: string };

    if (!companyName || !companyName.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Company name is required' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    const trimmedName = companyName.trim();

    // Check if company already exists (case-insensitive)
    const { data: existing } = await serviceClient
      .from('companies')
      .select('id, name, logo_url')
      .ilike('name', `%${trimmedName}%`)
      .limit(5)
      .maybeSingle();

    let company;
    if (existing) {
      // Find exact match if available
      const exact = existing.name.toLowerCase() === trimmedName.toLowerCase();
      if (exact) {
        company = existing;
        // Update logo if provided and company doesn't have one
        if (logoUrl && !company.logo_url) {
          await serviceClient
            .from('companies')
            .update({ logo_url: logoUrl })
            .eq('id', company.id);
          company.logo_url = logoUrl;
        }
      } else {
        // Try to find exact match in the results
        const { data: allMatches } = await serviceClient
          .from('companies')
          .select('id, name, logo_url')
          .ilike('name', `%${trimmedName}%`)
          .limit(5);
        
        const exactMatch = allMatches?.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
        company = exactMatch || existing;
        // Update logo if provided and company doesn't have one
        if (logoUrl && company && !company.logo_url) {
          await serviceClient
            .from('companies')
            .update({ logo_url: logoUrl })
            .eq('id', company.id);
          company.logo_url = logoUrl;
        }
      }
    }

    if (!company) {
      // Create new company using service role (bypasses RLS)
      const insertData: { name: string; logo_url?: string } = { name: trimmedName };
      if (logoUrl) {
        insertData.logo_url = logoUrl;
      }
      
      const { data: newCompany, error: createError } = await serviceClient
        .from('companies')
        .insert(insertData)
        .select('id, name, logo_url')
        .single();

      if (createError) {
        // If unique constraint violation, try to find existing
        if ((createError as any).code === '23505') {
          const { data: found } = await serviceClient
            .from('companies')
            .select('id, name, logo_url')
            .ilike('name', `%${trimmedName}%`)
            .limit(1)
            .maybeSingle();
          
          if (found) {
            company = found;
            // Update logo if provided and company doesn't have one
            if (logoUrl && !company.logo_url) {
              await serviceClient
                .from('companies')
                .update({ logo_url: logoUrl })
                .eq('id', company.id);
              company.logo_url = logoUrl;
            }
          } else {
            return new Response(
              JSON.stringify({ ok: false, error: createError.message }),
              { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ ok: false, error: createError.message }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
          );
        }
      } else {
        company = newCompany;
      }
    }

    // Add to user's watchlist (this should work with RLS since we're authenticated)
    const { error: watchlistError } = await userClient
      .from('user_watchlist')
      .upsert(
        {
          user_id: user.id,
          company_id: company.id,
        },
        { onConflict: 'user_id,company_id', ignoreDuplicates: true }
      );

    if (watchlistError) {
      return new Response(
        JSON.stringify({ ok: false, error: watchlistError.message }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, company }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? 'Unknown error' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }
});

