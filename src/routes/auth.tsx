import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { sendWelcomeEmail } from "@/lib/welcome-email.functions";

const PENDING_CODE = "mc-pending-invite-code";
const PENDING_SLUG = "mc-pending-celebration";
import { claimGuestInvite, type ClaimResult } from "@/lib/guest-access.functions";
import { claimHostInvite } from "@/lib/host-invite.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSiteContent } from "@/lib/site-content";
import { celebrationStyle, useCelebrationBySlug } from "@/lib/public-celebration";

const searchSchema = z.object({
  code: z.string().max(64).optional().catch(undefined),
  mode: z.enum(["signin", "signup"]).optional().catch(undefined),
  c: z.string().max(80).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign In — My Celebration" },
      {
        name: "description",
        content:
          "Sign in with your invitation code to see your events, reply, choose your look and send measurements.",
      },
      { property: "og:title", content: "Sign In — My Celebration" },
      {
        property: "og:description",
        content: "Register with your invitation code to open the guest wardrobe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  code: z.string().trim().min(4, "Enter the invitation code from your invite").max(64),
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Enter your password").max(72),
  code: z.string().trim().max(64),
});

function AuthPage() {
  const { t } = useSiteContent();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const celebration = useCelebrationBySlug(search.c).data ?? null;
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">(
    search.mode === "signin" ? "signin" : "signup",
  );

  const [signUpForm, setSignUpForm] = useState({
    fullName: "",
    email: "",
    password: "",
    code: search.code ?? "",
  });
  const [signInForm, setSignInForm] = useState({
    email: "",
    password: "",
    code: search.code ?? "",
  });

  // Record that the invitation link was opened, so hosts can see who clicked.
  useEffect(() => {
    if (search.code) void supabase.rpc("mark_invite_opened", { _code: search.code });
  }, [search.code]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(signUpForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setBusy(false);
      toast.success("Almost there — confirm your email, then sign in with your invitation code.");
      setTab("signin");
      return;
    }
    const isHostCode = parsed.data.code.trim().toUpperCase().startsWith("HOST-");
    if (parsed.data.code) await claimInvite(parsed.data.code);
    setBusy(false);
    navigate({ to: isHostCode ? "/host" : "/guest/invite" });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse(signInForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const isHostCode = parsed.data.code.trim().toUpperCase().startsWith("HOST-");
    if (parsed.data.code) await claimInvite(parsed.data.code);
    setBusy(false);
    navigate({ to: isHostCode ? "/host" : "/guest/invite" });
  };

  const finishSocial = async () => {
    const code = localStorage.getItem(PENDING_CODE) ?? "";
    const slug = localStorage.getItem(PENDING_SLUG) || search.c || null;
    localStorage.removeItem(PENDING_CODE);
    localStorage.removeItem(PENDING_SLUG);
    if (code) await claimInvite(code);
    void sendWelcomeEmail({ data: { slug } }).catch(() => {});
    navigate({ to: code.trim().toUpperCase().startsWith("HOST-") ? "/host" : "/guest/invite" });
  };

  // Back from a Google / Microsoft / Apple redirect: use the saved code, then move on.
  useEffect(() => {
    if (localStorage.getItem(PENDING_CODE) === null) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void finishSocial();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const social = async (provider: "google" | "microsoft" | "apple") => {
    const code = (tab === "signup" ? signUpForm.code : signInForm.code).trim();
    localStorage.setItem(PENDING_CODE, code);
    localStorage.setItem(PENDING_SLUG, search.c ?? "");
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      localStorage.removeItem(PENDING_CODE);
      setBusy(false);
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
    await finishSocial();
    setBusy(false);
  };

  return (
    <div
      className="bg-zari flex min-h-dvh flex-col bg-background"
      style={celebrationStyle(celebration)}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        {celebration?.slug ? (
          <Link
            to="/$celebration"
            params={{ celebration: celebration.slug }}
            className="flex items-center gap-3 font-display text-lg tracking-wide"
          >
            {celebration.cover_logo_url ? (
              <img src={celebration.cover_logo_url} alt="" className="h-9 w-auto object-contain" />
            ) : null}
            {celebration.name}
          </Link>
        ) : (
          <Link to="/" className="font-display text-lg tracking-wide">
            {t("landing.brand", "My Celebration")}
          </Link>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <div className="panel p-4 sm:p-6 sm:p-8">
          <p className="text-eyebrow">{t("auth.eyebrow", "Guests and hosts")}</p>
          <h1 className="mt-3 text-3xl">
            {celebration ? celebration.name : t("auth.title", "Welcome")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "auth.body",
              "Sign in with the code we sent you, then see your events, reply and choose your look.",
            )}
          </p>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "signin" | "signup")}
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Register</TabsTrigger>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-code">Invitation code</Label>
                  <Input
                    id="su-code"
                    value={signUpForm.code}
                    maxLength={64}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. MEHNDI-4821"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hosts: use the HOST- code from your email.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input
                    id="su-name"
                    value={signUpForm.fullName}
                    maxLength={100}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    value={signUpForm.email}
                    maxLength={255}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    type="password"
                    value={signUpForm.password}
                    maxLength={72}
                    onChange={(e) => setSignUpForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Register"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    value={signInForm.email}
                    maxLength={255}
                    onChange={(e) => setSignInForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-password">Password</Label>
                  <Input
                    id="si-password"
                    type="password"
                    value={signInForm.password}
                    maxLength={72}
                    onChange={(e) => setSignInForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-code">Invitation code (only if it's your first time)</Label>
                  <Input
                    id="si-code"
                    value={signInForm.code}
                    maxLength={64}
                    onChange={(e) => setSignInForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Leave empty if you've used it already"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with
              <span className="h-px flex-1 bg-border" />
            </div>
            <p className="text-xs text-muted-foreground">
              First time? Enter your invitation or HOST- code above first.
            </p>
            {(["google", "microsoft", "apple"] as const).map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => social(p)}
              >
                {p === "google" ? "Google" : p === "microsoft" ? "Microsoft" : "Apple"}
              </Button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export async function claimInvite(code: string) {
  const trimmed = code.trim();
  if (trimmed.toUpperCase().startsWith("HOST-")) {
    let hostResult: ClaimResult;
    try {
      hostResult = await claimHostInvite({ data: { code: trimmed } });
    } catch {
      toast.error("We couldn't confirm that host invitation. Please try again.");
      return false;
    }
    if (!hostResult.ok) {
      toast.error(hostResult.error ?? "That host code could not be used");
      return false;
    }
    toast.success("Welcome — you can now help host the wedding.");
    return true;
  }

  let result: ClaimResult;
  try {
    result = await claimGuestInvite({ data: { code: trimmed } });
  } catch {
    toast.error("We couldn't confirm that invitation. Please try again.");
    return false;
  }
  if (!result.ok) {
    toast.error(result.error ?? "That invitation code could not be used");
    return false;
  }
  toast.success("Invitation confirmed — welcome!");
  return true;
}
