import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ScanSearch,
  ShieldCheck,
  User,
} from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: "signin" | "signup" | "forgot";
}

export function AuthModal({ open, onOpenChange, defaultView = "signin" }: AuthModalProps) {
  const { login, loginWithGoogle, signup, forgotPassword, resetPassword } = useAuth();

  const [view, setView] = useState<"signin" | "signup" | "forgot" | "reset-code">(defaultView);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset internal states when opened
  React.useEffect(() => {
    if (open) {
      setView(defaultView);
      setError(null);
    }
  }, [open, defaultView]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      onOpenChange(false);
    } catch {
      setError("Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await signup(name, email, password);
      onOpenChange(false);
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onOpenChange(false);
    } catch {
      setError("Google authentication could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setView("reset-code");
    } catch {
      setError("Could not process password reset request.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetCode) {
      setError("Please enter the 6-digit confirmation code.");
      return;
    }
    if (password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, resetCode, password);
      setView("signin");
    } catch {
      setError("Invalid or expired reset code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0 overflow-hidden border border-border/80 shadow-2xl bg-card">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-xs text-white shadow-inner mb-3">
            <ScanSearch className="size-6 text-sky-400" />
          </div>
          <DialogTitle className="text-xl font-bold font-display tracking-tight text-white">
            {view === "signin" && "Sign In to BiasLens"}
            {view === "signup" && "Create Your Account"}
            {view === "forgot" && "Reset Password"}
            {view === "reset-code" && "Verify Reset Code"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300 mt-1">
            {view === "signin" &&
              "Access your AI fairness audits, neutral rewrites, and saved resumes."}
            {view === "signup" &&
              "Start screening resumes with counterfactual neutrality and zero bias."}
            {view === "forgot" && "Enter your email to receive a password reset link."}
            {view === "reset-code" && "Enter the verification code and set your new password."}
          </DialogDescription>
        </div>

        {/* Form Body */}
        <div className="p-6 pt-4">
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
              <span className="font-semibold">Notice:</span> {error}
            </div>
          )}

          {/* GOOGLE SIGN IN BUTTON (on signin and signup views) */}
          {(view === "signin" || view === "signup") && (
            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-border bg-background hover:bg-muted font-medium text-xs flex items-center justify-center gap-2.5 transition-all shadow-2xs"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                {/* Official Google G Logo SVG */}
                <svg className="size-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/80" />
                </div>
                <span className="relative bg-card px-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>
          )}

          {/* VIEW: SIGN IN */}
          {view === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="size-3.5 text-muted-foreground" />
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 pr-9 text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-9 text-xs font-semibold mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" /> Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setView("signup");
                      setError(null);
                    }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Create account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* VIEW: SIGN UP */}
          {view === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Jordan Lee"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="size-3.5 text-muted-foreground" />
                    Password
                  </Label>
                  <Input
                    type="password"
                    placeholder="Min 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-muted-foreground" />
                    Confirm
                  </Label>
                  <Input
                    type="password"
                    placeholder="Repeat"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  defaultChecked
                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                />
                <label htmlFor="terms" className="text-[11px] text-muted-foreground">
                  I agree to BiasLens Privacy Policy & Terms of Service
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-9 text-xs font-semibold mt-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" /> Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setView("signin");
                      setError(null);
                    }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {view === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Your Account Email
                </Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-9 text-xs font-semibold mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" /> Sending link...
                  </>
                ) : (
                  "Send Reset Instructions"
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView("signin");
                    setError(null);
                  }}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* VIEW: VERIFY RESET CODE */}
          {view === "reset-code" && (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Reset code sent! Check your inbox (or use demo code: 123456).</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  6-Digit Verification Code
                </Label>
                <Input
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="h-9 text-xs font-mono tracking-wider"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" />
                  New Password
                </Label>
                <Input
                  type="password"
                  placeholder="Enter new strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-9 text-xs font-semibold mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" /> Updating Password...
                  </>
                ) : (
                  "Set New Password & Sign In"
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView("signin");
                    setError(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Cancel and return to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
