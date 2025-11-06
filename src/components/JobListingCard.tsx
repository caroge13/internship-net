import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, MapPin, TrendingUp, Award, Globe, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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

interface JobListingCardProps {
  job: JobListing;
  onAppliedChange?: () => void;
}

export const JobListingCard = ({ job, onAppliedChange }: JobListingCardProps) => {
  const { toast } = useToast();
  const [isApplied, setIsApplied] = useState(job.isApplied || false);
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleToggleApplied = async (checked: boolean) => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to track applications",
          variant: "destructive",
        });
        return;
      }

      if (checked) {
        // Mark as applied
        const { error } = await supabase.from("user_job_applications").upsert({
          user_id: user.id,
          job_id: job.id,
        });
        if (error) throw error;
        setIsApplied(true);
        toast({
          title: "application tracked",
          description: "marked as applied",
        });
      } else {
        // Remove applied status
        const { error } = await supabase
          .from("user_job_applications")
          .delete()
          .eq("user_id", user.id)
          .eq("job_id", job.id);
        if (error) throw error;
        setIsApplied(false);
        toast({
          title: "application removed",
          description: "removed from applied list",
        });
      }
      onAppliedChange?.();
    } catch (error: any) {
      console.error("Error updating application status:", error);
      toast({
        title: "error",
        description: error.message || "failed to update application status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={`hover:shadow-[var(--shadow-card-hover)] transition-all duration-300 ${
        isApplied ? "opacity-50" : ""
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <Checkbox
                checked={isApplied}
                onCheckedChange={handleToggleApplied}
                disabled={isLoading}
                className="mt-1"
              />
              <CardTitle
                className={`text-xl mb-2 ${isApplied ? "line-through" : ""}`}
              >
                {job.title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {job.company.logo_url && (
                <img
                  src={job.company.logo_url}
                  alt={job.company.name}
                  className="w-6 h-6 rounded object-cover"
                />
              )}
              <span className={`font-medium ${isApplied ? "line-through" : ""}`}>
                {job.company.name}
              </span>
            </div>
          </div>
          {job.url && (
            <Button size="sm" asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                Apply
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={`space-y-4 ${isApplied ? "opacity-50" : ""}`}>
        <div className={isApplied ? "line-through" : ""}>
          {/* Location and Visa Sponsorship - Always visible */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {job.location || "Location not specified"}
            </Badge>
            {job.visa_sponsorship && (
              <Badge variant="default" className="flex items-center gap-1 bg-primary text-primary-foreground">
                <Globe className="w-3 h-3" />
                Visa Sponsorship
              </Badge>
            )}
            {job.term && (
              <Badge variant="secondary">Term: {job.term}</Badge>
            )}
          </div>

          {/* Key Skills - Always show section, even if empty */}
          {job.key_skills && job.key_skills.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Key Skills</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.key_skills.map((skill, index) => (
                  <Badge key={index} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Acceptance Rate - Always show */}
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Acceptance Rate:</span>
            <Badge variant="outline">
              {job.acceptance_rate ? `${job.acceptance_rate}%` : "Not available"}
            </Badge>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Posted</p>
                <p className="font-medium">{formatDate(job.post_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Deadline</p>
                <p className="font-medium">
                  {job.is_rolling ? "Rolling" : job.due_date ? formatDate(job.due_date) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Description - less prominent */}
          {job.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{job.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
