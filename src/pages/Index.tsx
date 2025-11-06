import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Briefcase, Bell, TrendingUp, Search, CheckCircle, Globe } from "lucide-react";
// Using public/struggling.jpg for hero background

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative px-4 overflow-hidden min-h-[80vh] flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 20, 40, 0.7)), url(/struggling.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 animate-pulse"></div>
        
        <div className="container mx-auto text-center relative z-10 py-20">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-[0_0_20px_hsl(195_85%_55%_/_0.5)]">
            <span className="italic">Catch</span> internships at your
            <br />
            <span className="text-white drop-shadow-[0_0_10px_hsl(195_85%_55%_/_0.8)]">dream companies</span>
          </h1>
          <p className="text-xl text-foreground/90 mb-8 max-w-2xl mx-auto">
            I know you're unemployed, and i am too, so don't miss when job postings 'swim' by (hehe get it?)
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild className="bg-gradient-to-r from-primary to-accent text-black font-bold hover:shadow-[0_0_20px_hsl(195_85%_55%_/_0.5)] transition-all">
              <Link to="/auth?mode=signup">Start Tracking Companies</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-primary/50 text-foreground hover:bg-primary/10 hover:border-primary hover:shadow-[0_0_15px_hsl(195_85%_55%_/_0.3)] transition-all"
            >
              <Link to="/dashboard">Open Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Is This You Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-card/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-[60%] px-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <img 
                  src="/ajobplsibeg.png" 
                  alt="Struggling with internship search" 
                  className="relative w-full h-auto rounded-lg border border-primary/20"
                />
              </div>
            </div>
            <div className="w-full md:w-[40%] px-4">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Is this you? 
                <br />
                (it's me)
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-card/50 to-transparent">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">"many fish in the sea"... right!?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="shadow-[var(--shadow-card)] transition-all duration-300 border-primary/20 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-br from-primary to-accent shadow-[0_0_15px_hsl(195_85%_55%_/_0.5)]">
                  <Search className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">multi-company tracking</h3>
                <p className="text-muted-foreground">
                  Add all your target companies to one watchlist! No more searching each company
                  individually on job boards or on their own websites.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)] transition-all duration-300 border-primary/20 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-br from-primary to-accent shadow-[0_0_15px_hsl(195_85%_55%_/_0.5)]">
                  <Bell className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">instant job alerts</h3>
                <p className="text-muted-foreground">
                  Get notified immediately when your watchlist companies post new internship
                  opportunities. No more manually checking each company's website for new postings.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)] transition-all duration-300 border-primary/20 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-br from-primary to-accent shadow-[0_0_15px_hsl(195_85%_55%_/_0.5)]">
                  <TrendingUp className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Detailed Insights</h3>
                <p className="text-muted-foreground">
                  View acceptance rates, key skills, deadlines, visa sponsorship status, and company
                  culture info.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Information Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-card/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">what you'll see</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/10 bg-card/50 hover:border-primary/30 hover:bg-card/70 transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_hsl(195_85%_55%_/_0.4)]">
                <CheckCircle className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground">Application Deadlines</h3>
                <p className="text-muted-foreground">
                  Know exactly when to apply with clear post dates and due dates or rolling
                  application indicators.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/10 bg-card/50 hover:border-primary/30 hover:bg-card/70 transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_hsl(195_85%_55%_/_0.4)]">
                <TrendingUp className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground">Acceptance Rates</h3>
                <p className="text-muted-foreground">
                  Understand your chances with transparent acceptance rate data for each position (but don't let it stop you!).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/10 bg-card/50 hover:border-primary/30 hover:bg-card/70 transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_hsl(195_85%_55%_/_0.4)]">
                <Globe className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground">Visa Sponsorship Status</h3>
                <p className="text-muted-foreground">
                  Filter for companies offering visa sponsorship for Canadian citizens and
                  international students.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/10 bg-card/50 hover:border-primary/30 hover:bg-card/70 transition-all">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_hsl(195_85%_55%_/_0.4)]">
                <Briefcase className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground">Company Culture & Values</h3>
                <p className="text-muted-foreground">
                  Learn about each company's culture, values, and what makes them unique before you
                  apply (would you vibe with them?).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-card/30">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">ready to start?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Track your favourite companies and see internships in one place.
          </p>
          <Button size="lg" asChild className="bg-gradient-to-r from-primary to-accent text-black font-bold hover:shadow-[0_0_25px_hsl(195_85%_55%_/_0.6)] transition-all">
            <Link to="/auth?mode=signup">Start Tracking Companies</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-primary/20">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2025 InternshipNet. Catch postings when they drop, get the job.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
