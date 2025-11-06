import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
// Using favico.png instead of Briefcase icon
import { Link } from "react-router-dom";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showForgotPassword) return; // Don't process auth if showing forgot password
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "success!",
          description: "account created successfully. you can now sign in.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "welcome back!",
          description: "successfully signed in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "error",
        description: "please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "email sent!",
        description: "check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      toast({
        title: "error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-card-hover)]">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/favico.png" alt="InternshipNet logo" className="w-8 h-8" />
              <span className="font-bold text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                InternshipNet
              </span>
            </Link>
          </div>
          <CardTitle className="text-2xl">{isSignUp ? "create an account" : "welcome back"}</CardTitle>
          <CardDescription>
            {isSignUp ? "enter your details to get started" : "sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="john doe"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                disabled={showForgotPassword && resetEmailSent}
              />
            </div>
            {!showForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            )}
            {showForgotPassword ? (
              <>
                <Button type="button" className="w-full bg-gradient-to-r from-primary to-accent text-white hover:opacity-90" disabled={loading || resetEmailSent} onClick={handleForgotPassword}>
                  {loading ? "loading..." : resetEmailSent ? "email sent!" : "send reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmailSent(false);
                  }}
                >
                  back to sign in
                </Button>
              </>
            ) : (
              <>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-white hover:opacity-90" disabled={loading}>
              {loading ? "loading..." : isSignUp ? "sign up" : "sign in"}
            </Button>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="w-full text-sm text-primary hover:underline mt-2"
                  >
                    forgot your password?
                  </button>
                )}
              </>
            )}
          </form>
          {!showForgotPassword && (
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp ? "already have an account? sign in" : "don't have an account? sign up"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
