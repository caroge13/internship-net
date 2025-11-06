import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

interface Company {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  hasAlert?: boolean;
  logo_url?: string;
}

interface CompanyWatchlistProps {
  companies: Company[];
  onCompanyAdded: () => void;
  onCompanyRemoved: () => void;
  onAlertToggled: () => void;
}

export const CompanyWatchlist = ({
  companies,
  onCompanyAdded,
  onCompanyRemoved,
  onAlertToggled,
}: CompanyWatchlistProps) => {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id?: string; name: string; logoUrl?: string; linkedinUrl?: string }>>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ id?: string; name: string; logoUrl?: string; linkedinUrl?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Search for companies as user types - includes LinkedIn-style company database
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (companyName.trim().length < 2) {
      setSearchResults([]);
      setOpen(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      
      const query = companyName.trim().toLowerCase();
      
      if (query.length < 2) {
        setSearchResults([]);
        setOpen(false);
        setSearching(false);
        return;
      }
      
      // Search LinkedIn for companies (not database - this is for adding new companies)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSearchResults([]);
        setOpen(false);
        setSearching(false);
        return;
      }

      try {
          const linkedinResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-linkedin-companies`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ query: companyName.trim() }),
            }
          );
          
          const linkedinResult = await linkedinResponse.json();
          
          const allResults: Array<{ id?: string; name: string; logoUrl?: string; linkedinUrl?: string }> = [];
          const seen = new Set<string>();

          // Add LinkedIn search results
          if (linkedinResult.ok && linkedinResult.companies) {
            for (const company of linkedinResult.companies) {
              const companyNameLower = company.name.toLowerCase();
              if (!seen.has(companyNameLower)) {
                allResults.push({
                  name: company.name,
                  logoUrl: company.logoUrl,
                  linkedinUrl: company.linkedinUrl,
                });
                seen.add(companyNameLower);
              }
            }
          }
          
          // Also check if any of these companies already exist in our database
          if (allResults.length > 0) {
            const companyNames = allResults.map(r => r.name);
            const { data: existingCompanies } = await supabase
              .from("companies")
              .select("id, name, logo_url")
              .in("name", companyNames);
            
            if (existingCompanies) {
              // Update results with database IDs and logos if available
              for (const result of allResults) {
                const existing = existingCompanies.find(c => c.name.toLowerCase() === result.name.toLowerCase());
                if (existing) {
                  result.id = existing.id;
                  // Use database logo if available, otherwise keep LinkedIn logo
                  if (existing.logo_url) {
                    result.logoUrl = existing.logo_url;
                  }
                }
              }
            }
          }

          // Sort: exact matches first, then partial matches
          const queryLower = companyName.trim().toLowerCase();
          allResults.sort((a, b) => {
            const aLower = a.name.toLowerCase();
            const bLower = b.name.toLowerCase();
            const aExact = aLower === queryLower;
            const bExact = bLower === queryLower;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) return -1;
            if (!aLower.startsWith(queryLower) && bLower.startsWith(queryLower)) return 1;
            return aLower.localeCompare(bLower);
          });

          // Show results immediately
          setSearchResults(allResults.slice(0, 10));
          setOpen(allResults.length > 0);
        } catch (err) {
          console.error("Error searching companies:", err);
          setSearchResults([]);
          setOpen(false);
        } finally {
          setSearching(false);
        }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [companyName]);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only allow adding if a company was selected from the dropdown
    if (!selectedCompany) {
      toast({
        title: "please select a company",
        description: "select a company from the dropdown to add it",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Only add the selected company
      const companyNameToAdd = selectedCompany.name;

      let addedCount = 0;
      let skipped: string[] = [];
      let failed: { name: string; reason: string }[] = [];

      // Process the selected company (must have LinkedIn URL to be valid)
      const trimmedName = companyNameToAdd.trim();
      if (!trimmedName) {
        throw new Error("Company name is required");
      }

      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expired. Please sign in again.");
      }

      // Validate that the selected company has a LinkedIn URL (from dropdown)
      if (!selectedCompany.linkedinUrl && !selectedCompany.id) {
        failed.push({
          name: trimmedName,
          reason: "Company must exist on LinkedIn. Please select from the dropdown.",
        });
      } else {
        try {
          // Try Edge Function first (bypasses RLS using service role)
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-company`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ 
                  companyName: trimmedName,
                  logoUrl: selectedCompany.logoUrl 
                }),
              }
            );

            const result = await response.json();

            if (result.ok && result.company) {
              // Company was added and added to watchlist by the Edge Function
              // Logo is already saved by the Edge Function
              addedCount++;
              // Trigger company info scraping in background
              supabase.functions.invoke("scrape-company-info", {
                body: { companyId: result.company.id, companyName: result.company.name },
              }).then(() => {
                // Refresh data after scraping completes
                onCompanyAdded();
              }).catch(err => console.log("Scraping company info failed:", err));
            } else {
              // Edge Function failed, fall through to direct insert
              throw new Error(result.error || "Edge Function failed");
            }
          } catch (edgeErr: any) {
            // Fallback to direct insert if Edge Function fails
            console.warn("Edge Function failed, trying direct insert:", edgeErr);

            // Case-insensitive lookup
            let { data: companies } = await supabase
              .from("companies")
              .select("id,name,description,logo_url")
              .ilike("name", `%${trimmedName}%`)
              .limit(5);

            let company: { id: string; name: string; description?: string; logo_url?: string } | null = null;
            if (companies && companies.length > 0) {
              const exactMatch = companies.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
              company = exactMatch || companies[0];
              
              // Update logo if provided and company doesn't have one
              if (company && selectedCompany.logoUrl && !company.logo_url) {
                await supabase
                  .from("companies")
                  .update({ logo_url: selectedCompany.logoUrl })
                  .eq("id", company.id);
                company.logo_url = selectedCompany.logoUrl;
              }
              
              // If company exists but has no description, trigger scraping
              if (company && !company.description) {
                // Trigger company info scraping in background
                supabase.functions.invoke("scrape-company-info", {
                  body: { companyId: company.id, companyName: company.name },
                }).then(() => {
                  // Refresh data after scraping completes
                  onCompanyAdded();
                }).catch(err => console.log("Scraping company info failed:", err));
              }
            }

            if (!company) {
              // Verify authentication state before insert
              const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
              const { data: { session } } = await supabase.auth.getSession();
              
              console.log("Auth check before insert:", {
                user: authUser?.id,
                email: authUser?.email,
                hasSession: !!session,
                sessionExpiry: session?.expires_at,
                accessToken: session?.access_token ? "present" : "missing",
                tokenLength: session?.access_token?.length,
                error: authErr
              });

              if (!authUser || !session) {
                throw new Error("Not authenticated. Please sign in again.");
              }

              // Create company directly (will fail if RLS blocks it)
              // Get the current session with headers
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              
              console.log("=== DEBUG: About to insert company ===");
              console.log("Company name:", trimmedName);
              console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
              console.log("Expected URL:", "https://dusgpkhtuzztfbjuywcs.supabase.co");
              console.log("URLs match:", import.meta.env.VITE_SUPABASE_URL === "https://dusgpkhtuzztfbjuywcs.supabase.co");
              console.log("Has API key:", !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
              console.log("Key prefix:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20));
              console.log("User role:", authUser?.role);
              console.log("User ID:", authUser?.id);
              
              // Test if we can read from companies table first
              console.log("Testing SELECT query...");
              const { data: testRead, error: readError } = await supabase
                .from("companies")
                .select("id, name")
                .limit(1);
              
              console.log("SELECT test result:", {
                canRead: !readError,
                error: readError?.message,
                errorCode: readError?.code,
                dataCount: testRead?.length || 0
              });
              
              // Direct insert (RLS should be disabled)
              console.log("Attempting INSERT...");
              const insertData: { name: string; logo_url?: string } = { name: trimmedName };
              if (selectedCompany.logoUrl) {
                insertData.logo_url = selectedCompany.logoUrl;
              }
              const insertResult = await supabase
                .from("companies")
                .insert(insertData)
                .select("id,name,logo_url")
                .single();
              
              const { data: newCompany, error: createError } = insertResult;

              // Trigger company info scraping in background
              if (newCompany && !createError) {
                supabase.functions.invoke("scrape-company-info", {
                  body: { companyId: newCompany.id, companyName: trimmedName },
                }).then(() => {
                  // Refresh data after scraping completes
                  onCompanyAdded();
                }).catch(err => console.log("Scraping company info failed:", err));
              }
              
              console.log("=== INSERT RESULT ===");
              console.log("Success:", !createError);
              console.log("Data:", newCompany);
              console.log("Error:", createError);
              if (createError) {
                console.log("Error code:", createError.code);
                console.log("Error message:", createError.message);
                console.log("Error details:", createError.details);
                console.log("Error hint:", createError.hint);
              }
              console.log("=====================");

              if (createError) {
                console.error("Company insert error details:", {
                  message: createError.message,
                  code: (createError as any).code,
                  details: createError.details,
                  hint: createError.hint,
                  status: (createError as any).status,
                  error: createError
                });
                throw createError;
              }
              company = newCompany;
            }

            if (!company || !company.id) {
              throw new Error(`Could not find or create company: ${trimmedName}`);
            }

            // Add to watchlist
            const { error: watchlistError } = await supabase
              .from("user_watchlist")
              .upsert(
                {
                  user_id: user.id,
                  company_id: company.id,
                },
                { onConflict: "user_id,company_id", ignoreDuplicates: true }
              );

            if (watchlistError) {
              if ((watchlistError as any).code === "23505") {
                skipped.push(String(company?.name ?? trimmedName));
              } else {
                throw watchlistError;
              }
            } else {
              addedCount++;
            }
          }
        } catch (err: any) {
          failed.push({ name: trimmedName, reason: String(err?.message ?? "Unknown error") });
        }
      }

      // Clear selection after processing
      setSelectedCompany(null);

      const parts: string[] = [];
      if (addedCount > 0) parts.push(`${addedCount} added`);
      if (skipped.length > 0) parts.push(`${skipped.length} already in watchlist`);
      if (failed.length > 0) parts.push(`${failed.length} failed`);

      if (failed.length > 0) {
        console.error("Failed to add companies:", failed);
      }

      toast({
        title: failed.length > 0 && addedCount === 0 ? "error adding companies" : "watchlist updated",
        description: failed.length > 0 
          ? `${parts.join(" · ")}${failed.length > 0 ? ` (${failed.map(f => `${f.name}: ${f.reason}`).join(", ")})` : ""}`
          : parts.join(" · ") || "no changes",
        variant: failed.length > 0 && addedCount === 0 ? "destructive" : "default",
      });

      if (addedCount > 0) {
        setCompanyName("");
        setSelectedCompany(null);
        onCompanyAdded();
      }
    } catch (error: any) {
      console.error("Error in handleAddCompany:", error);
      toast({
        title: "error",
        description: error.message || "failed to add company. check console for details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCompany = async (companyId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("company_id", companyId);

      if (error) throw error;

      toast({
        title: "Removed",
        description: "Company removed from watchlist",
      });

      onCompanyRemoved();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleAlert = async (companyId: string, currentHasAlert: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (currentHasAlert) {
        // Remove alert
        const { error } = await supabase
          .from("job_alerts")
          .delete()
          .eq("user_id", user.id)
          .eq("company_id", companyId);

        if (error) throw error;
      } else {
        // Add alert
        const { error } = await supabase.from("job_alerts").insert({
          user_id: user.id,
          company_id: companyId,
          alert_frequency: "daily",
        });

        if (error) throw error;
      }

      toast({
        title: currentHasAlert ? "Alert disabled" : "Alert enabled",
        description: currentHasAlert
          ? "You will no longer receive job alerts for this company"
          : "You will receive daily job alerts for this company",
      });

      onAlertToggled();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSelectCompany = (company: { id?: string; name: string; logoUrl?: string; linkedinUrl?: string }) => {
    setCompanyName(company.name);
    setSelectedCompany(company);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleAddCompany} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setSelectedCompany(null); // Clear selection when typing
                  if (e.target.value.trim().length >= 2) {
                    setOpen(true);
                  } else {
                    setOpen(false);
                  }
                }}
                placeholder="search for companies (dream big, pookie 💗)"
                disabled={loading}
                className="w-full"
                onFocus={() => {
                  if (companyName.trim().length >= 2 && searchResults.length > 0) {
                    setOpen(true);
                  }
                }}
                onBlur={() => {
                  // Delay closing to allow click events
                  setTimeout(() => setOpen(false), 200);
                }}
              />
              {open && (searchResults.length > 0 || companyName.trim().length >= 2) && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  <Command>
                    <CommandList>
                      {searching && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          searching...
                        </div>
                      )}
                      {!searching && searchResults.length === 0 && companyName.trim().length >= 2 && (
                        <CommandEmpty>no companies found</CommandEmpty>
                      )}
                      {!searching && searchResults.length > 0 && (
                        <CommandGroup>
                          {searchResults.map((company, index) => (
                            <CommandItem
                              key={company.id || `ext-${index}-${company.name}`}
                              value={company.name}
                              onSelect={() => {
                                handleSelectCompany(company);
                                setOpen(false);
                              }}
                              className="cursor-pointer flex items-center gap-3 py-3"
                            >
                              {company.logoUrl ? (
                                <img
                                  src={company.logoUrl}
                                  alt={company.name}
                                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                                  onError={(e) => {
                                    // Hide image if it fails to load
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex-shrink-0 flex items-center justify-center text-xs font-semibold">
                                  {company.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="flex-1 truncate">{company.name}</span>
                              {!company.id && company.linkedinUrl && (
                                <span className="ml-2 text-xs text-muted-foreground">(linkedin)</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            <Button type="submit" disabled={loading} className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 h-10">
              <Plus className="w-4 h-4 mr-2" />
              add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((company) => (
          <Card
            key={company.id}
            className="hover:shadow-[var(--shadow-card-hover)] transition-all duration-300"
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          // Hide image if it fails to load
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 flex items-center justify-center text-sm font-semibold">
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h3 className="font-semibold text-lg truncate">{company.name}</h3>
                  </div>
                  {company.industry && (
                    <Badge variant="secondary" className="mt-2">
                      <span>{company.industry}</span>
                    </Badge>
                  )}
                  {company.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                      {company.description.split(/[.!?]+/)[0]}.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="icon"
                    variant={company.hasAlert ? "default" : "outline"}
                    onClick={() => handleToggleAlert(company.id, company.hasAlert || false)}
                    className={company.hasAlert ? "bg-gradient-to-r from-primary to-accent text-white hover:opacity-90" : ""}
                  >
                    {company.hasAlert ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveCompany(company.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {companies.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>No companies in your watchlist yet. Add some to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
