import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  domain_id: string | null;
  is_paid: boolean;
}

interface Domain {
  id: string;
  domain_name: string;
  free_companies_remaining: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  domain: Domain | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return;
    }

    if (!profileData) {
      setProfile(null);
      setDomain(null);
      return;
    }

    setProfile(profileData);

    if (!profileData.domain_id) {
      setDomain(null);
      return;
    }

    const { data: domainData, error: domainError } = await supabase
      .from("domains")
      .select("*")
      .eq("id", profileData.domain_id)
      .maybeSingle();

    if (domainError) {
      console.error("Error fetching domain:", domainError);
      return;
    }

    setDomain(domainData ?? null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const failSafeTimeout = window.setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 6000);

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        setTimeout(() => {
          void fetchProfile(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setDomain(null);
      }

      setLoading(false);
      window.clearTimeout(failSafeTimeout);
    });

    const initSession = async () => {
      try {
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          void fetchProfile(existingSession.user.id);
        }
      } catch (error) {
        console.error("Error checking auth session:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
          window.clearTimeout(failSafeTimeout);
        }
      }
    };

    void initSession();

    return () => {
      isMounted = false;
      window.clearTimeout(failSafeTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    });

    if (!error) {
      // Update profile with name and company after signup
      // The trigger creates the profile, we just need to update it
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName, company_name: companyName })
          .eq("id", newUser.id);
      }
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setDomain(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        domain,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
