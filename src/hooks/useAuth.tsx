import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type ProfileStatus = "pendente" | "aprovado" | "bloqueado" | null;

interface AuthContext {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  profileStatus: ProfileStatus;
  signIn: (email: string, password: string) => Promise<{ status: ProfileStatus }>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(null);

  const checkAdmin = async (uid: string) => {
    try {
      const { data, error } = await supabase.rpc("is_admin", { _user_id: uid });
      if (error) { setIsAdmin(false); return; }
      setIsAdmin(!!data);
    } catch { setIsAdmin(false); }
  };

  const checkProfileStatus = async (uid: string): Promise<ProfileStatus> => {
    try {
      const { data } = await supabase.from("profiles").select("status").eq("id", uid).single();
      const status = (data?.status as ProfileStatus) || "pendente";
      setProfileStatus(status);
      return status;
    } catch {
      setProfileStatus("pendente");
      return "pendente";
    }
  };

  useEffect(() => {
    let mounted = true;

    const safelySetAuthState = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        void checkAdmin(nextSession.user.id);
        void checkProfileStatus(nextSession.user.id);
      } else {
        setIsAdmin(false);
        setProfileStatus(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => { safelySetAuthState(nextSession); }
    );

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      safelySetAuthState(initialSession);
    });

    const loadingTimeout = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Check profile status
    if (data.user) {
      const status = await checkProfileStatus(data.user.id);
      if (status !== "aprovado") {
        // Don't sign out - let the app redirect to waiting page
        return { status };
      }
      await supabase.from("user_sessions").insert({ user_id: data.user.id });
    }
    return { status: "aprovado" as ProfileStatus };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfileStatus(null);
  };

  return (
    <AuthCtx.Provider value={{ user, session, isAdmin, loading, profileStatus, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
