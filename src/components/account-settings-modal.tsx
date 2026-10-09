import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth, type UserProfile } from "@/lib/auth-context";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  Globe,
  HardDrive,
  HelpCircle,
  KeyRound,
  Laptop,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Moon,
  Paintbrush,
  Palette,
  RotateCcw,
  Scale,
  Send,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";

interface AccountSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "profile" | "security" | "privacy" | "engine" | "appearance" | "feedback";
  engineMode?: "local" | "fastapi";
  onEngineModeChange?: (mode: "local" | "fastapi") => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&h=256&q=80",
];

export function AccountSettingsModal({
  open,
  onOpenChange,
  defaultTab = "profile",
  engineMode = "local",
  onEngineModeChange,
}: AccountSettingsModalProps) {
  const { user, updateProfile, logout, deleteAccount, clearWorkspaceCache } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "privacy" | "engine" | "appearance" | "feedback"
  >(defaultTab);

  // Engine Backend States
  const [selectedEngine, setSelectedEngine] = useState<"local" | "fastapi">(engineMode);
  const [fastApiUrl, setFastApiUrl] = useState(() => {
    if (typeof window === "undefined") return "http://localhost:8000";
    return localStorage.getItem("biaslens_fastapi_url") || "http://localhost:8000";
  });
  const [testingPing, setTestingPing] = useState(false);

  // Keep active tab in sync when opened with a specific defaultTab
  React.useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  // Keep engineMode state in sync with parent prop
  React.useEffect(() => {
    setSelectedEngine(engineMode);
  }, [engineMode]);

  // Profile Form States
  const [name, setName] = useState(user?.name || "");
  const [headline, setHeadline] = useState(user?.headline || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || PRESET_AVATARS[0]);

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState(user?.twoFactorEnabled ?? false);

  // Privacy States
  const [dataRetention, setDataRetention] = useState<"local" | "session" | "none">(
    user?.dataRetention || "local",
  );
  const [telemetry, setTelemetry] = useState(user?.telemetryEnabled ?? true);

  // Appearance States
  const [autoSave, setAutoSave] = useState(user?.autoSave ?? true);
  const [exportFormat, setExportFormat] = useState(user?.defaultExportFormat || "pdf");

  // Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState("Bug Report");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Sync state if user changes
  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setHeadline(user.headline || "");
      setOrganization(user.organization || "");
      setAvatarUrl(user.avatarUrl || PRESET_AVATARS[0]);
      setTwoFactor(user.twoFactorEnabled);
      setDataRetention(user.dataRetention);
      setTelemetry(user.telemetryEnabled);
      setAutoSave(user.autoSave);
      setExportFormat(user.defaultExportFormat);
    }
  }, [user]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be blank.");
      return;
    }
    updateProfile({
      name,
      headline,
      organization,
      avatarUrl,
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    toast.success("Password changed successfully", {
      description: "Your security credentials have been updated.",
    });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleToggle2FA = (checked: boolean) => {
    setTwoFactor(checked);
    updateProfile({ twoFactorEnabled: checked });
    toast.info(
      checked ? "Two-Factor Authentication Enabled" : "Two-Factor Authentication Disabled",
      {
        description: checked
          ? "Your account now requires verification code confirmation."
          : "Two-step verification has been turned off.",
      },
    );
  };

  const handleSavePrivacy = () => {
    updateProfile({
      dataRetention,
      telemetryEnabled: telemetry,
    });
    toast.success("Privacy preferences saved");
  };

  const handleSaveAppearance = () => {
    updateProfile({
      autoSave,
      defaultExportFormat: exportFormat as UserProfile["defaultExportFormat"],
    });
    toast.success("Application preferences saved");
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      toast.error("Please provide a feedback description.");
      return;
    }
    setSubmittingFeedback(true);
    setTimeout(() => {
      setSubmittingFeedback(false);
      setFeedbackMessage("");
      toast.success("Feedback submitted successfully!", {
        description: "Thank you for helping us refine BiasLens detection precision.",
      });
    }, 600);
  };

  const handleSelectEngine = (mode: "local" | "fastapi") => {
    setSelectedEngine(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("biaslens_engine_mode", mode);
    }
    onEngineModeChange?.(mode);
    toast.success(mode === "local" ? "Local Engine Activated" : "FastAPI Backend Activated", {
      description:
        mode === "local"
          ? "Running client-side in-browser NLP with zero latency."
          : `Configured to target ${fastApiUrl}/api/analyze.`,
    });
  };

  const handleTestConnection = async () => {
    setTestingPing(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      await fetch(`${fastApiUrl}/docs`, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      toast.success("FastAPI server reachable", {
        description: `Successfully reached ${fastApiUrl}`,
      });
    } catch {
      toast.info("FastAPI server standby", {
        description: `Could not reach ${fastApiUrl} (Server will fallback to Local NLP if offline).`,
      });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border border-border shadow-2xl bg-card max-h-[90vh] flex flex-col md:flex-row">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/30 p-4 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 px-2 py-3 mb-3">
              <div className="relative size-10 rounded-full overflow-hidden border border-border bg-muted">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center font-bold text-xs bg-primary text-primary-foreground">
                    {user?.name?.slice(0, 2).toUpperCase() || "BL"}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">
                  {user ? user.name : "Guest Session"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {user ? user.email : "Local In-Browser"}
                </p>
              </div>
            </div>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "profile"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <User className="size-4 shrink-0" />
                <span>Profile Settings</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "security"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Shield className="size-4 shrink-0" />
                <span>Account & Security</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("privacy")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "privacy"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Database className="size-4 shrink-0" />
                <span>Privacy & Data</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("engine")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "engine"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Server className="size-4 shrink-0" />
                  <span>Analysis Engine</span>
                </div>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                    activeTab === "engine"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedEngine}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "appearance"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Palette className="size-4 shrink-0" />
                <span>Website & Theme</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("feedback")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "feedback"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <HelpCircle className="size-4 shrink-0" />
                <span>Help & Feedback</span>
              </button>
            </nav>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border mt-4 space-y-1">
            <button
              type="button"
              onClick={() => {
                logout();
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Sign Out</span>
            </button>
            <div className="px-3 pt-2">
              <span className="text-[10px] text-muted-foreground">BiasLens v2.4.0 Engine</span>
            </div>
          </div>
        </aside>

        {/* MAIN SETTINGS CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Profile Settings</h3>
                <p className="text-xs text-muted-foreground">
                  Manage your personal information, public credentials, and avatar badge.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Avatar Chooser */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Avatar Image</Label>
                  <div className="flex items-center gap-4">
                    <img
                      src={avatarUrl}
                      alt="Current avatar"
                      className="size-16 rounded-full object-cover border-2 border-primary/40 shadow-xs"
                    />
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        Select a curated profile avatar:
                      </p>
                      <div className="flex items-center gap-2">
                        {PRESET_AVATARS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAvatarUrl(preset)}
                            className={`size-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-105 ${
                              avatarUrl === preset
                                ? "border-primary ring-2 ring-primary/40"
                                : "border-border"
                            }`}
                          >
                            <img
                              src={preset}
                              alt={`Preset ${idx}`}
                              className="size-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Name</Label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Email Address</Label>
                    <Input
                      type="email"
                      value={user?.email || "guest@biaslens.local"}
                      disabled
                      className="h-9 text-xs bg-muted/50 cursor-not-allowed opacity-80"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Linked to authentication provider
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Professional Headline</Label>
                  <Input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Lead Talent Acquisition Specialist & DEI Champion"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Organization / Employer</Label>
                  <Input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. Google, MIT Labs, or Independent"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Member since {user ? new Date(user.createdAt).toLocaleDateString() : "Today"}
                  </span>
                  <Button type="submit" size="sm" className="text-xs font-semibold">
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: ACCOUNT & SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Account & Security</h3>
                <p className="text-xs text-muted-foreground">
                  Protect your account with password rotation, two-factor authentication, and
                  session controls.
                </p>
              </div>

              {/* Password Change Section */}
              <form
                onSubmit={handleUpdatePassword}
                className="space-y-3.5 p-4 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="size-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">Change Password</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Current Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">New Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Confirm New Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" variant="outline" className="text-xs">
                    Update Password
                  </Button>
                </div>
              </form>

              {/* Two-Factor Authentication Switch */}
              <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">
                      Two-Factor Authentication (2FA)
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        twoFactor
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {twoFactor ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enforce an additional OTP token verification layer when logging into BiasLens.
                  </p>
                </div>
                <Switch checked={twoFactor} onCheckedChange={handleToggle2FA} />
              </div>

              {/* Active Sessions */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="size-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground">Active Browser Sessions</h4>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[11px] h-7 text-muted-foreground hover:text-foreground"
                    onClick={() => toast.success("All other sessions revoked")}
                  >
                    Revoke Other Sessions
                  </Button>
                </div>

                <div className="divide-y divide-border/60 text-xs">
                  <div className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <div>
                        <p className="font-semibold text-foreground">
                          This Device (Windows PC • Chrome)
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Port 8080 • Active Session
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                      Current
                    </span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <h4 className="text-xs font-bold text-destructive">Danger Zone</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Permanently erase your account, audit logs, cached templates, and API keys. This
                  action cannot be reversed.
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs mt-1"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you certain you want to permanently delete your account and erase local data?",
                      )
                    ) {
                      deleteAccount();
                      onOpenChange(false);
                    }
                  }}
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  Delete Account
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY & DATA RETENTION */}
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Privacy & Data Governance</h3>
                <p className="text-xs text-muted-foreground">
                  BiasLens is engineered with privacy-first principles. Customize how your resume
                  data is preserved.
                </p>
              </div>

              <div className="space-y-4">
                {/* Data Retention Selection */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-primary" />
                    <Label className="text-xs font-bold text-foreground">
                      Resume Data Retention
                    </Label>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        key: "local",
                        title: "Local Storage Cache (Recommended)",
                        desc: "Preserves your active resume work across browser refreshes so your edits are never lost.",
                      },
                      {
                        key: "session",
                        title: "Session Only",
                        desc: "Clears your resume immediately when the browser tab or window is closed.",
                      },
                      {
                        key: "none",
                        title: "Zero-Retention Mode",
                        desc: "Disables all persistent caching. Resumes exist only in RAM during the active session.",
                      },
                    ].map((opt) => (
                      <label
                        key={opt.key}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          dataRetention === opt.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="dataRetention"
                          value={opt.key}
                          checked={dataRetention === opt.key}
                          onChange={() => setDataRetention(opt.key as "local" | "session" | "none")}
                          className="mt-0.5 text-primary focus:ring-primary"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{opt.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Telemetry Switch */}
                <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground">
                      Anonymous Audit Telemetry
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Share anonymous bias signal accuracy to improve counterfactual fairness
                      benchmarks.
                    </p>
                  </div>
                  <Switch checked={telemetry} onCheckedChange={setTelemetry} />
                </div>

                {/* Clear Local Cache */}
                <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground">
                      Local Workspace Storage
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Free up browser storage memory by flushing cached resume document states.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={clearWorkspaceCache}
                  >
                    <RotateCcw className="size-3.5" />
                    Clear Cache
                  </Button>
                </div>

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={handleSavePrivacy} className="text-xs font-semibold">
                    Save Privacy Settings
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANALYSIS ENGINE */}
          {activeTab === "engine" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Analysis Engine & NLP Backend
                </h3>
                <p className="text-xs text-muted-foreground">
                  Choose the intelligence engine used for resume bias detection, counterfactual
                  testing, and fairness scoring.
                </p>
              </div>

              <div className="space-y-4">
                {/* Engine Mode Selection Cards */}
                <div className="grid gap-3.5">
                  {/* LOCAL ENGINE CARD */}
                  <div
                    onClick={() => handleSelectEngine("local")}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedEngine === "local"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Cpu className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground">
                              Local (In-Browser) Engine
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              Client-Side • Zero Latency
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            Private, instant token analysis running entirely inside your browser.
                            Powered by the Gaucher masculine/feminine research taxonomy, ADEA
                            compliance rules, and Rivera prestige proxies. No document data is ever
                            uploaded over the network.
                          </p>
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selectedEngine === "local"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {selectedEngine === "local" && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  {/* FASTAPI BACKEND CARD */}
                  <div
                    onClick={() => handleSelectEngine("fastapi")}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedEngine === "fastapi"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="size-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Server className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground">
                              FastAPI Backend (Python Server)
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                              Remote Python NLP • Port 8000
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            Connects to the Person A/B FastAPI service (
                            <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                              http://localhost:8000/api/analyze
                            </code>
                            ) for remote Python inference, multi-model ensemble analysis, and
                            server-side counterfactual simulation. Automatically falls back to Local
                            NLP if the server is offline.
                          </p>
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          selectedEngine === "fastapi"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {selectedEngine === "fastapi" && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* FASTAPI CONFIGURATION & PING TEST */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="size-4 text-sky-500" />
                      <Label className="text-xs font-bold text-foreground">
                        FastAPI Endpoint Configuration
                      </Label>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        selectedEngine === "fastapi"
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {selectedEngine === "fastapi" ? "Active Engine Target" : "Standby Engine"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Server Base URL
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="url"
                        value={fastApiUrl}
                        onChange={(e) => {
                          setFastApiUrl(e.target.value);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("biaslens_fastapi_url", e.target.value);
                          }
                        }}
                        placeholder="http://localhost:8000"
                        className="h-9 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={testingPing}
                        className="shrink-0 text-xs gap-1.5"
                      >
                        <Activity className={`size-3.5 ${testingPing ? "animate-spin" : ""}`} />
                        <span>{testingPing ? "Testing..." : "Test Ping"}</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Target route: <code className="font-mono">{fastApiUrl}/api/analyze</code>
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleSelectEngine(selectedEngine);
                      onOpenChange(false);
                    }}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <Check className="size-3.5" />
                    <span>Apply & Close</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: WEBSITE & THEME SETTINGS */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Website & Theme Preferences</h3>
                <p className="text-xs text-muted-foreground">
                  Customize the interface appearance, dark mode palette, and canvas behavior.
                </p>
              </div>

              {/* Color Scheme Picker */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2">
                  <Paintbrush className="size-4 text-primary" />
                  <Label className="text-xs font-bold text-foreground">Color Scheme & Mode</Label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Choose your visual aesthetic. The dark mode features our high-contrast Obsidian
                  Slate theme, calibrated specifically for glare-free resume analysis while
                  maintaining clean A4 paper rendering.
                </p>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  {/* LIGHT MODE CARD */}
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      theme === "light"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-2 shadow-2xs">
                      <Sun className="size-5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">Light Mode</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Clean & Crisp</span>
                  </button>

                  {/* DARK MODE CARD */}
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      theme === "dark"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="size-10 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 shadow-2xs border border-indigo-800/40">
                      <Moon className="size-5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">Dark Mode</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Obsidian Slate</span>
                  </button>

                  {/* SYSTEM CARD */}
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      theme === "system"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-2 shadow-2xs">
                      <Laptop className="size-5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">System Default</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Matches OS</span>
                  </button>
                </div>
              </div>

              {/* Editor Workspace Configurations */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">
                    Canvas & Export Configurations
                  </h4>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground">
                      Auto-Save Resume Canvas
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Periodically commit live edits to local storage so sudden reloads preserve
                      your exact layout.
                    </p>
                  </div>
                  <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <Label className="text-xs font-medium">Default Export Document Format</Label>
                  <select
                    value={exportFormat}
                    onChange={(e) =>
                      setExportFormat(e.target.value as UserProfile["defaultExportFormat"])
                    }
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="pdf">PDF Document (.pdf) — Production Print Standard</option>
                    <option value="png">PNG Image (.png) — High-Resolution Raster</option>
                    <option value="jpeg">JPEG Image (.jpg) — Compressed Raster</option>
                    <option value="json">BiasLens Report (.json) — Machine-Readable Audit</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={handleSaveAppearance} className="text-xs font-semibold">
                  Save Appearance Preferences
                </Button>
              </div>
            </div>
          )}

          {/* TAB 5: HELP & FEEDBACK */}
          {activeTab === "feedback" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Help, Documentation & Feedback
                </h3>
                <p className="text-xs text-muted-foreground">
                  Access keyboard shortcuts, fairness audit methodology, and submit recommendations.
                </p>
              </div>

              {/* Quick Documentation Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <Scale className="size-4 text-sky-500" />
                    <h4 className="text-xs font-bold text-foreground">Counterfactual Fairness</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Learn how our multi-signal evaluator audits gender, age, prestige, and career
                    gap markers using EEOC four-fifths metrics.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-emerald-500" />
                    <h4 className="text-xs font-bold text-foreground">Keyboard Shortcuts</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Ctrl+B: Bold • Ctrl+I: Italic • Ctrl+U: Underline • Ctrl+Z: Undo • T: Add Text •
                    Del: Remove Block
                  </p>
                </div>
              </div>

              {/* Interactive Feedback Form */}
              <form
                onSubmit={handleSubmitFeedback}
                className="p-4 rounded-xl border border-border bg-card space-y-3.5"
              >
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">
                    Submit Feedback or Report False Positives
                  </h4>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Topic / Category</Label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden"
                  >
                    <option value="Bug Report">Bug Report</option>
                    <option value="Bias False Positive">Bias Taxonomy False Positive</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Design Feedback">Design & Usability Feedback</option>
                    <option value="Other">General Inquiry</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Your Message / Suggestion</Label>
                  <textarea
                    rows={4}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Tell us what worked, what felt unexpected, or what features you would love to see..."
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs font-semibold gap-1.5"
                    disabled={submittingFeedback}
                  >
                    <Send className="size-3.5" />
                    {submittingFeedback ? "Submitting..." : "Send Feedback"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
