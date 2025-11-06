import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { CompanyWatchlist } from "@/components/CompanyWatchlist";
import { JobListingCard } from "@/components/JobListingCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  hasAlert?: boolean;
  logo_url?: string;
}

interface JobListing {
  id: string;
  title: string;
  company: {
    name: string;
    logo_url?: string;
  };
  description?: string;
  post_date: string;
  due_date?: string;
  is_rolling: boolean;
  acceptance_rate?: number;
  key_skills: string[];
  visa_sponsorship: boolean;
  location: string;
  term?: string;
  url?: string;
  isApplied?: boolean;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [geoFilter, setGeoFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load watchlist
      const { data: watchlistData, error: watchlistError } = await supabase
        .from("user_watchlist")
        .select(
          `
          company_id,
          companies (
            id,
            name,
            description,
            industry,
            logo_url
          )
        `
        )
        .eq("user_id", user.id);

      if (watchlistError) throw watchlistError;

      // Load alerts
      const { data: alertsData } = await supabase
        .from("job_alerts")
        .select("company_id")
        .eq("user_id", user.id);

      const alertCompanyIds = new Set(alertsData?.map((a) => a.company_id) || []);

      const companiesWithAlerts =
        watchlistData?.map((item: any) => ({
          ...item.companies,
          hasAlert: alertCompanyIds.has(item.companies.id),
        })) || [];

      setCompanies(companiesWithAlerts);

      // Load jobs for watchlist companies
      if (companiesWithAlerts.length > 0) {
        const companyIds = companiesWithAlerts.map((c) => c.id);
        console.log("Loading jobs for companies:", companyIds);
        
        const { data: jobsData, error: jobsError } = await supabase
          .from("job_listings")
          .select(
            `
            *,
            companies (
              name,
              logo_url
            )
          `
          )
          .in("company_id", companyIds)
          .ilike("title", "%intern%")
          .order("post_date", { ascending: false });

        if (jobsError) {
          console.error("Error loading jobs:", jobsError);
          throw jobsError;
        }

        console.log("Loaded jobs from database:", jobsData?.length || 0, jobsData);

        // Load applied jobs for current user
        const { data: appliedJobs } = await supabase
          .from("user_job_applications")
          .select("job_id")
          .eq("user_id", user.id);

        const appliedJobIds = new Set(appliedJobs?.map((a) => a.job_id) || []);

        const formattedJobs =
          jobsData?.map((job: any) => ({
            ...job,
            company: job.companies,
            isApplied: appliedJobIds.has(job.id),
          })) || [];

        // Sort: non-applied first, then applied (both sorted by post_date desc)
        formattedJobs.sort((a, b) => {
          if (a.isApplied === b.isApplied) {
            return new Date(b.post_date).getTime() - new Date(a.post_date).getTime();
          }
          return a.isApplied ? 1 : -1; // Applied jobs go to bottom
        });

        console.log("Formatted jobs:", formattedJobs.length);
        setJobs(formattedJobs);
      } else {
        console.log("No companies in watchlist, skipping job load");
        setJobs([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshJobs = async () => {
    try {
      setRefreshing(true);
      const companyIds = companies.map((c) => c.id);
      if (companyIds.length === 0) {
        toast({
          title: "No companies in watchlist",
          description: "Add companies to your watchlist first",
          variant: "destructive",
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke("scrape-careers", {
        body: { companyIds, geographies: geoFilter ? [geoFilter] : [] },
      });
      
      if (error) {
        console.error("Error invoking scrape-careers:", error);
        toast({
          title: "Error refreshing jobs",
          description: error.message || "Failed to scrape jobs",
          variant: "destructive",
        });
      } else {
        console.log("Scrape result:", data);
        toast({
          title: "Jobs refreshed",
          description: data?.totalInserted ? `${data.totalInserted} jobs found` : "No new jobs found",
        });
      }
      
      // Reload data to show new jobs
      await loadData();
    } catch (e: any) {
      console.error("Error refreshing jobs", e);
      toast({
        title: "Error refreshing jobs",
        description: e?.message || "Failed to refresh jobs",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your watchlist and discover new internship opportunities
          </p>
        </div>

        <Tabs defaultValue="watchlist" className="space-y-6">
          <TabsList>
            <TabsTrigger value="watchlist">My Watchlist</TabsTrigger>
            <TabsTrigger value="jobs">Job Listings</TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
              <CompanyWatchlist
                companies={companies}
                onCompanyAdded={loadData}
                onCompanyRemoved={loadData}
                onAlertToggled={loadData}
              />
            )}
          </TabsContent>

          <TabsContent value="jobs">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Input
                      value={geoFilter}
                      onChange={(e) => setGeoFilter(e.target.value)}
                      placeholder="Filter by geography (e.g., Canada, Toronto, Remote)"
                      className="md:w-80"
                    />
                    <Button variant="outline" onClick={() => setGeoFilter("")}>clear</Button>
                  </div>
                  <Button onClick={handleRefreshJobs} disabled={refreshing || companies.length === 0} className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "refreshing" : "refresh jobs"}
                  </Button>
                </div>

                {(() => {
                  const filteredJobs = jobs.filter(j => !geoFilter || (j.location ?? "").toLowerCase().includes(geoFilter.toLowerCase()));
                  
                  console.log("Rendering jobs tab - total jobs:", jobs.length, "filter:", geoFilter);
                  console.log("Filtered jobs:", filteredJobs.length);
                  
                  if (filteredJobs.length === 0 && jobs.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg">No job listings yet.</p>
                        <p className="text-sm mt-2">
                          Add companies to your watchlist and click <strong>Refresh Jobs</strong> to scrape their career pages.
                        </p>
                        <p className="text-xs mt-4 text-muted-foreground">
                          Check the browser console and Edge Function logs for debugging info.
                        </p>
                      </div>
                    );
                  }
                  
                  if (filteredJobs.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg">No job listings match the current filters.</p>
                        <p className="text-sm mt-2">Try adjusting your geography filter or click Refresh Jobs to scrape new listings.</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredJobs.map((job) => (
                        <JobListingCard 
                          key={job.id} 
                          job={job} 
                          onAppliedChange={loadData}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
