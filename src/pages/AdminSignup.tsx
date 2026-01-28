import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function AdminSignup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signUp(
      formData.email,
      formData.password,
      formData.name,
      formData.company
    );

    if (error) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: "Account created",
      description: "Welcome to DealScope! Contact an existing admin to grant you admin access.",
    });
    navigate("/dashboard");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container-wide h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to home</span>
          </Link>
          <Link to="/" className="text-lg font-semibold text-foreground">
            DealScope
          </Link>
          <div className="w-24"></div>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-muted-foreground mb-4">
              <Shield className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider font-medium">Admin Signup</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Create admin account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Any email address is accepted. Admin role must be granted separately.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Smith"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                type="text"
                placeholder="DealScope"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground hover:underline font-medium">
              Log in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">
          This signup page is for internal use only.
        </p>
      </footer>
    </div>
  );
}
