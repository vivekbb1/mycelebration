import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { claimGuestInvite, type ClaimResult } from "@/lib/guest-access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  code: z.string().max(64).optional().catch(undefined),
  mode: z.enum(["signin", "signup"]).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Guest Sign In — The Wedding Wardrobe" },
      {
        name: "description",
        content:
          "Register with your invitation code or sign in to reserve your festive Indian outfit and send measurements.",
      },
      { property: "og:title", content: "Guest Sign In — The Wedding Wardrobe" },
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
  code: z.string().trim().max(64),
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Enter your password").max(72),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
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
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });

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
    if (parsed.data.code) await claimInvite(parsed.data.code);
    setBusy(false);
    navigate({ to: "/lookbook" });
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
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/lookbook" });
  };

  return (
    <div className="bg-zari flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-lg tracking-wide">
          The Wedding Wardrobe
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <div className="panel p-6 sm:p-8">
          <p className="text-eyebrow">Guests only</p>
          <h1 className="mt-3 text-3xl">Welcome</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Register with the invitation code from your WhatsApp or email, then pick your outfits.
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
                    Hosts can leave this blank.
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export async function claimInvite(code: string) {
  let result: ClaimResult;
  try {
    result = await claimGuestInvite({ data: { code } });
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
