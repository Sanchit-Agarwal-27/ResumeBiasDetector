import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (name: string, email: string, password?: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  logout: () => void;
  deleteAccount: () => void;
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
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return null;
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // localStorage disabled or full
    }
  }, [user]);

  const login = async (email: string, _password?: string): Promise<boolean> => {
    // Simulated realistic async authentication
    await new Promise((resolve) => setTimeout(resolve, 600));

    const existingUsersRaw = localStorage.getItem("biaslens_registered_users");
    const registered: Record<string, UserProfile> = existingUsersRaw
      ? JSON.parse(existingUsersRaw)
      : {};

    let userToLogin: UserProfile;

    if (registered[email.toLowerCase()]) {
      userToLogin = {
        ...registered[email.toLowerCase()],
        lastLogin: new Date().toISOString(),
      };
    } else {
      // Auto-provision demo account for quick evaluation
      const generatedName = email.split("@")[0].replace(/[._]/g, " ");
      const capitalized = generatedName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      userToLogin = {
        ...defaultDemoUser,
        id: `usr_${Math.random().toString(36).substring(2, 9)}`,
        name: capitalized || "BiasLens Professional",
        email: email.toLowerCase(),
        lastLogin: new Date().toISOString(),
      };
    }

    setUser(userToLogin);
    toast.success(`Welcome back, ${userToLogin.name}!`, {
      description: "Signed in securely to your BiasLens workspace.",
    });
    return true;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 800));

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

  const signup = async (name: string, email: string, _password?: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 700));

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

    try {
      const existingUsersRaw = localStorage.getItem("biaslens_registered_users");
      const registered: Record<string, UserProfile> = existingUsersRaw
        ? JSON.parse(existingUsersRaw)
        : {};
      registered[newUser.email] = newUser;
      localStorage.setItem("biaslens_registered_users", JSON.stringify(registered));
    } catch {
      // storage error
    }

    setUser(newUser);
    toast.success("Account created successfully!", {
      description: `Welcome to BiasLens, ${newUser.name}. Your workspace is ready.`,
    });
    return true;
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.success("Password reset instructions sent", {
      description: `If an account exists for ${email}, a password reset link has been dispatched.`,
    });
    return true;
  };

  const resetPassword = async (
    email: string,
    _code: string,
    _newPassword: string,
  ): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    toast.success("Password updated successfully", {
      description: "You may now sign in with your new credentials.",
    });
    return true;
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    toast.success("Profile settings updated", {
      description: "Your account preferences have been saved.",
    });
  };

  const logout = () => {
    setUser(null);
    toast.info("Signed out of BiasLens", {
      description: "You are now working in guest mode.",
    });
  };

  const deleteAccount = () => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem("biaslens_cached_workspace");
    } catch {
      // ignore
    }
    toast.success("Account removed", {
      description: "All profile details and local session keys have been wiped.",
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
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
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
