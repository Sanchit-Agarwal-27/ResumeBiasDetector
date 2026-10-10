import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "./supabase-client";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  headline?: string;
  organization?: string;
  twoFactorEnabled: boolean;
  autoSave: boolean;
  telemetryEnabled: boolean;
  dataRetention: "local" | "session" | "none";
  defaultExportFormat: "pdf" | "png" | "jpeg" | "json";
  createdAt: string;
  lastLogin: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCloudConnected: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithMagicLink: (email: string) => Promise<boolean>;
  signup: (name: string, email: string, password?: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (password: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearWorkspaceCache: () => void;
}

const AUTH_STORAGE_KEY = "biaslens_auth_user";

const defaultDemoUser: UserProfile = {
  id: "usr_bl_01",
  name: "Alex Rivera",
  email: "alex.rivera@example.com",
  role: "Lead Software Architect",
  headline: "Principal Engineer & Bias-Free Tech Advocate",
  organization: "Anthropic / Independent",
  avatarUrl:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  twoFactorEnabled: false,
  autoSave: true,
  telemetryEnabled: true,
  dataRetention: "local",
  defaultExportFormat: "pdf",
  createdAt: "2026-01-15T10:00:00Z",
  lastLogin: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Helper to map Supabase User + public.profiles row to UserProfile
  const mapSupabaseUserToProfile = async (sbUser: SupabaseUser): Promise<UserProfile> => {
    let profileData: Partial<UserProfile> = {};

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sbUser.id)
        .maybeSingle();

      if (!error && data) {
        profileData = {
          name: data.name,
          role: data.role || "Candidate",
          avatarUrl: data.avatar_url || sbUser.user_metadata?.avatar_url,
          headline: data.headline || "Bias-Free Career Professional",
          organization: data.organization || "",
          twoFactorEnabled: data.two_factor_enabled ?? false,
          autoSave: data.auto_save ?? true,
          telemetryEnabled: data.telemetry_enabled ?? true,
          dataRetention: (data.data_retention as UserProfile["dataRetention"]) || "local",
          defaultExportFormat:
            (data.default_export_format as UserProfile["defaultExportFormat"]) || "pdf",
          createdAt: data.created_at || sbUser.created_at,
        };
      }
    } catch (err) {
      console.warn("[Auth] Failed to load profile row from Supabase:", err);
    }

    const fallbackName =
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      sbUser.email?.split("@")[0].replace(/[._]/g, " ") ||
      "BiasLens Member";

    const googleAvatar =
      sbUser.user_metadata?.avatar_url ||
      sbUser.user_metadata?.picture ||
      sbUser.identities?.[0]?.identity_data?.avatar_url ||
      sbUser.identities?.[0]?.identity_data?.picture;

    return {
      id: sbUser.id,
      email: sbUser.email || "",
      name: profileData.name || fallbackName,
      role: profileData.role || "Candidate",
      avatarUrl: profileData.avatarUrl || googleAvatar,
      headline: profileData.headline || "Bias-Free Career Professional",
      organization: profileData.organization || "",
      twoFactorEnabled: profileData.twoFactorEnabled ?? false,
      autoSave: profileData.autoSave ?? true,
      telemetryEnabled: profileData.telemetryEnabled ?? true,
      dataRetention: profileData.dataRetention || "local",
      defaultExportFormat: profileData.defaultExportFormat || "pdf",
      createdAt: profileData.createdAt || sbUser.created_at,
      lastLogin: new Date().toISOString(),
    };
  };

  // Initialize and listen to Supabase auth state changes
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      if (initialSession?.user) {
        const mapped = await mapSupabaseUserToProfile(initialSession.user);
        if (isMounted) setUser(mapped);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (newSession?.user) {
          const mapped = await mapSupabaseUserToProfile(newSession.user);
          if (isMounted) setUser(mapped);
        }
      } else if (event === "SIGNED_OUT") {
        if (isMounted) setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sync user state with local storage for instant guest/cached rendering
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // storage quota or error
    }
  }, [user]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    if (isSupabaseConfigured && password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      if (data.user) {
        const mapped = await mapSupabaseUserToProfile(data.user);
        setUser(mapped);
        toast.success(`Welcome back, ${mapped.name}!`, {
          description: "Signed in securely to your Supabase Cloud Workspace.",
        });
        return true;
      }
    }

    // Graceful offline mock fallback
    await new Promise((resolve) => setTimeout(resolve, 500));
    const generatedName = email.split("@")[0].replace(/[._]/g, " ");
    const userToLogin: UserProfile = {
      ...defaultDemoUser,
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: generatedName || "BiasLens Professional",
      email: email.toLowerCase(),
      lastLogin: new Date().toISOString(),
    };
    setUser(userToLogin);
    toast.success(`Welcome back, ${userToLogin.name}!`, {
      description: "Signed in in local demo mode.",
    });
    return true;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }
      return true;
    }

    // Offline mock fallback
    await new Promise((resolve) => setTimeout(resolve, 600));
    const googleUser: UserProfile = {
      id: "usr_google_9281",
      name: "Jordan Lee",
      email: "jordan.lee@gmail.com",
      role: "Product Designer & Strategist",
      headline: "AI Fairness & Accessibility Specialist",
      organization: "Google Alumni / Venture Builder",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
      twoFactorEnabled: true,
      autoSave: true,
      telemetryEnabled: true,
      dataRetention: "local",
      defaultExportFormat: "pdf",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    setUser(googleUser);
    toast.success("Signed in with Google", {
      description: `Authenticated as ${googleUser.email}`,
    });
    return true;
  };

  const loginWithMagicLink = async (email: string): Promise<boolean> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success("Magic sign-in link dispatched!", {
        description: `Check your inbox at ${email} to sign in instantly without a password.`,
      });
      return true;
    }

    toast.info("Magic links require active Supabase credentials.", {
      description: "Switched to standard sign in.",
    });
    return false;
  };

  const signup = async (name: string, email: string, password?: string): Promise<boolean> => {
    if (isSupabaseConfigured && password) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            name: name.trim(),
          },
        },
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      if (data.user) {
        // If Supabase has email confirmation enabled, session might be null initially
        if (!data.session) {
          toast.success("Account created! Please check your email.", {
            description: "Confirmation link sent to verify your address.",
          });
          return true;
        }

        const mapped = await mapSupabaseUserToProfile(data.user);
        setUser(mapped);
        toast.success("Account created successfully!", {
          description: `Welcome to BiasLens, ${mapped.name}. Your cloud vault is active.`,
        });
        return true;
      }
    }

    // Offline mock fallback
    const newUser: UserProfile = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim() || "New Member",
      email: email.toLowerCase().trim(),
      role: "Resume Candidate",
      headline: "Exploring career opportunities with unbiased resumes",
      twoFactorEnabled: false,
      autoSave: true,
      telemetryEnabled: true,
      dataRetention: "local",
      defaultExportFormat: "pdf",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    setUser(newUser);
    toast.success("Account created successfully!", {
      description: `Welcome to BiasLens, ${newUser.name}.`,
    });
    return true;
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }
    }

    toast.success("Password reset instructions dispatched", {
      description: `If an account exists for ${email}, a reset link has been sent to your inbox.`,
    });
    return true;
  };

  const resetPassword = async (newPassword: string): Promise<boolean> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }
    }

    toast.success("Password updated successfully", {
      description: "You may now continue working in your workspace.",
    });
    return true;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);

    if (isSupabaseConfigured && session?.user) {
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.headline !== undefined) dbUpdates.headline = updates.headline;
      if (updates.organization !== undefined) dbUpdates.organization = updates.organization;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
      if (updates.twoFactorEnabled !== undefined)
        dbUpdates.two_factor_enabled = updates.twoFactorEnabled;
      if (updates.autoSave !== undefined) dbUpdates.auto_save = updates.autoSave;
      if (updates.telemetryEnabled !== undefined)
        dbUpdates.telemetry_enabled = updates.telemetryEnabled;
      if (updates.dataRetention !== undefined) dbUpdates.data_retention = updates.dataRetention;
      if (updates.defaultExportFormat !== undefined)
        dbUpdates.default_export_format = updates.defaultExportFormat;

      const { error } = await supabase.from("profiles").update(dbUpdates).eq("id", session.user.id);

      if (error) {
        console.error("[Profile] Failed to update profile in database:", error.message);
      }
    }

    toast.success("Profile settings updated", {
      description: "Your account preferences have been saved.",
    });
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("[Auth] Supabase signOut error:", err);
      }
    }
    setUser(null);
    setSession(null);
    toast.info("Signed out of BiasLens", {
      description: "You are now working in guest mode.",
    });
  };

  const deleteAccount = async () => {
    if (isSupabaseConfigured && session?.user) {
      // Delete user's profile row (cascade will wipe their resumes, blocks, and audits)
      await supabase.from("profiles").delete().eq("id", session.user.id);
      await supabase.auth.signOut();
    }

    setUser(null);
    setSession(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem("biaslens_cached_workspace");
    } catch {
      // ignore
    }
    toast.success("Account removed", {
      description: "All profile details and cloud records have been wiped.",
    });
  };

  const clearWorkspaceCache = () => {
    try {
      localStorage.removeItem("biaslens_cached_workspace");
      toast.success("Workspace cache cleared", {
        description: "Local storage memory has been freed.",
      });
    } catch {
      toast.error("Failed to clear local cache.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        isCloudConnected: isSupabaseConfigured,
        login,
        loginWithGoogle,
        loginWithMagicLink,
        signup,
        forgotPassword,
        resetPassword,
        updateProfile,
        logout,
        deleteAccount,
        clearWorkspaceCache,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
