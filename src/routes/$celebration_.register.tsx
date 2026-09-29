import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { registerFamily, addFamilyMember } from "@/lib/family-signup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { celebrationStyle, useCelebrationBySlug } from "@/lib/public-celebration";
import { useSignupLink } from "@/lib/signup-link";

type G = "men" | "women" | "boy" | "girl";
const GENDERS: { v: G; label: string }[] = [
  { v: "men", label: "Man" },
  { v: "women", label: "Woman" },
  { v: "boy", label: "Boy" },
  { v: "girl", label: "Girl" },
];

export const Route = createFileRoute("/$celebration_/register")({
  validateSearch: z.object({ t: z.string().max(80).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Register your family — My Celebration" },
      { name: "description", content: "Register your family for the celebration and get your family code." },
      { property: "og:title", content: "Register your family — My Celebration" },
      { property: "og:description", content: "Add your family and members, then see the events you're invited to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterPage,
});

function GenderPick({ value, onChange }: { value: G; onChange: (g: G) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {GENDERS.map((g) => (
        <Button
          key={g.v}
          type="button"
          size="sm"
          variant={value === g.v ? "default" : "outline"}
          onClick={() => onChange(g.v)}
        >
          {g.label}
        </Button>
      ))}
    </div>
  );
}

function RegisterPage() {
  const { celebration: slug } = Route.useParams();
  const { t: token } = Route.useSearch();
  const navigate = useNavigate();
  const celebration = useCelebrationBySlug(slug).data ?? null;
  const link = useSignupLink(token);
  const [session, setSession] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [account, setAccount] = useState({ email: "", password: "", mode: "signup" as "signup" | "signin" });
  const [form, setForm] = useState({ familyName: "", fullName: "", email: "", phone: "", gender: "women" as G });
  const [members, setMembers] = useState<{ name: string; gender: G; email: string; phone: string }[]>([]);
  const [extra, setExtra] = useState({ name: "", gender: "women" as G, email: "", phone: "" });
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(Boolean(s)));
    return () => sub.subscription.unsubscribe();
  }, []);

  // While waiting for email confirmation, keep checking so the page moves on by itself
  // (e.g. when the link was opened in another tab, or after signing in with the password).
  useEffect(() => {
    if (!pending || session) return;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) { setSession(true); return; }
      const r = await supabase.auth.signInWithPassword({ email: pending, password: account.password });
      if (r.data.session) setSession(true);
    };
    const id = window.setInterval(check, 4000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(id); window.removeEventListener("focus", check); };
  }, [pending, session, account.password]);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res =
      account.mode === "signup"
        ? await supabase.auth.signUp({
            email: account.email.trim(),
            password: account.password,
            options: { emailRedirectTo: window.location.href },
          })
        : await supabase.auth.signInWithPassword({ email: account.email.trim(), password: account.password });
    setBusy(false);
    if (res.error) {
      if (/not confirmed/i.test(res.error.message)) { setPending(account.email.trim()); return; }
      toast.error(res.error.message);
      return;
    }
    if (!res.data.session) setPending(account.email.trim());
  };

  const resend = async () => {
    if (!pending) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: pending, options: { emailRedirectTo: window.location.href } });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Sent again — check your inbox.");
  };

  const social = async (provider: "google" | "microsoft" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.href });
    setBusy(false);
    if (result.error) toast.error(result.error.message ?? "Sign-in failed");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (form.fullName.trim().length < 2 || form.familyName.trim().length < 2) { toast.error("Please add your family name and your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { toast.error("Please enter a valid email."); return; }
    if (form.phone.replace(/\D/g, "").length < 7) { toast.error("Please enter your full mobile number, with country code (for example +971 50 123 4567)."); return; }
    if (members.some((m) => m.name.trim().length < 2)) { toast.error("Please give every member a name."); return; }
    const badMember = members.find((m) => (m.email.trim() && !/^\S+@\S+\.\S+$/.test(m.email.trim())) || (m.phone.trim() && m.phone.replace(/\D/g, "").length < 7));
    if (badMember) { toast.error(`Please check the email or mobile for ${badMember.name.trim()} — or leave them blank.`); return; }
    setBusy(true);
    try {
      const res = await registerFamily({
        data: { token, ...form, members: members.map((m) => ({ ...m, name: m.name.trim(), email: m.email.trim(), phone: m.phone.trim() })) },
      });
      if (!res.ok) toast.error(res.error ?? "We couldn't register your family.");
      else setDone(res.code ?? "");
    } catch {
      toast.error("Something in the form isn't right — please check the names, email and mobile number.");
    }
    setBusy(false);
  };

  const addLater = async () => {
    if (extra.name.trim().length < 2) { toast.error("Please add their full name."); return; }
    const em = extra.email.trim();
    const ph = extra.phone.trim();
    if ((em && !/^\S+@\S+\.\S+$/.test(em)) || (ph && ph.replace(/\D/g, "").length < 7)) {
      toast.error("Please check their email or mobile — or leave them blank.");
      return;
    }
    setBusy(true);
    const res = await addFamilyMember({ data: { name: extra.name.trim(), gender: extra.gender, email: em, phone: ph } });
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Couldn't add that person"); return; }
    toast.success(`${extra.name.trim()} added.`);
    setExtra({ name: "", gender: "women", email: "", phone: "" });
  };

  const title = link.data?.name ?? celebration?.name ?? "Register your family";

  let body: React.ReactNode;
  if (!token || (link.isFetched && !link.data)) {
    body = (
      <>
        <h1 className="text-3xl">This sign-up link isn't open</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ask the family who invited you for a fresh link, or sign in with your invitation code.
        </p>
        <Button asChild className="mt-6">
          <Link to="/auth" search={{ c: slug }}>Sign in with a code</Link>
        </Button>
      </>
    );
  } else if (done !== null) {
    body = (
      <>
        <p className="text-eyebrow">You're registered</p>
        <h1 className="mt-3 text-3xl">Welcome to {title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Share your family code with the people you added — they sign in with it to fill in their own details.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-lg">{done}</code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Copy family code"
            onClick={() => {
              void navigator.clipboard.writeText(done);
              toast.success("Copied");
            }}
          >
            <Copy className="size-4" />
          </Button>
        </div>
        <div className="mt-6 space-y-2">
          <Label>Add another family member</Label>
          <Input value={extra.name} maxLength={100} placeholder="Full name" onChange={(e) => setExtra((x) => ({ ...x, name: e.target.value }))} />
          <GenderPick value={extra.gender} onChange={(g) => setExtra((x) => ({ ...x, gender: g }))} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="email" maxLength={255} placeholder="Email (optional)" value={extra.email} onChange={(e) => setExtra((x) => ({ ...x, email: e.target.value }))} />
            <Input type="tel" maxLength={40} placeholder="Mobile (optional)" value={extra.phone} onChange={(e) => setExtra((x) => ({ ...x, phone: e.target.value }))} />
          </div>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={addLater}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <Button className="mt-8 w-full" onClick={() => navigate({ to: "/guest/invite" })}>
          See my invitation
        </Button>
      </>
    );
  } else if (session === false && pending) {
    body = (
      <>
        <p className="text-eyebrow">Step 1 of 2</p>
        <h1 className="mt-3 text-3xl">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We've sent a link to <strong>{pending}</strong>. Open it and tap the button inside — this page moves to the next step on its own once you have.
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block size-2 animate-pulse rounded-full bg-primary" /> Waiting for you to confirm…
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Can't find it? Look in your junk or spam folder.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={resend}>Send the email again</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>Use a different email</Button>
        </div>
      </>
    );
  } else if (session === false) {
    body = (
      <>
        <p className="text-eyebrow">Step 1 of 2</p>
        <h1 className="mt-3 text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">First, create your account.</p>
        <form onSubmit={createAccount} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="r-email">Email</Label>
            <Input id="r-email" type="email" maxLength={255} placeholder="you@example.com" value={account.email} onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-pw">Password</Label>
            <Input id="r-pw" type="password" maxLength={72} value={account.password} onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {account.mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline"
            onClick={() => setAccount((a) => ({ ...a, mode: a.mode === "signup" ? "signin" : "signup" }))}
          >
            {account.mode === "signup" ? "I already have an account" : "I need a new account"}
          </button>
        </form>
        <div className="mt-6 space-y-2">
          {(["google", "microsoft", "apple"] as const).map((p) => (
            <Button key={p} type="button" variant="outline" className="w-full" disabled={busy} onClick={() => social(p)}>
              {p === "google" ? "Google" : p === "microsoft" ? "Microsoft" : "Apple"}
            </Button>
          ))}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-eyebrow">Step 2 of 2</p>
        <h1 className="mt-3 text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tell us about your family.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="f-fam">Family name</Label>
            <Input id="f-fam" maxLength={80} placeholder="e.g. The Sharma family" value={form.familyName} onChange={(e) => setForm((f) => ({ ...f, familyName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-name">Your full name</Label>
            <Input id="f-name" maxLength={100} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f-email">Email</Label>
              <Input id="f-email" type="email" autoComplete="off" maxLength={255} placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-phone">Mobile</Label>
              <Input id="f-phone" type="tel" maxLength={40} placeholder="+971 50 123 4567" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>You are</Label>
            <GenderPick value={form.gender} onChange={(g) => setForm((f) => ({ ...f, gender: g }))} />
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Label>Other family members</Label>
            {members.map((m, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    maxLength={100}
                    placeholder="Full name"
                    value={m.name}
                    onChange={(e) => setMembers((ms) => ms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove member" onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <GenderPick value={m.gender} onChange={(g) => setMembers((ms) => ms.map((x, j) => (j === i ? { ...x, gender: g } : x)))} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    type="email"
                    maxLength={255}
                    placeholder="Email (optional)"
                    value={m.email}
                    onChange={(e) => setMembers((ms) => ms.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                  />
                  <Input
                    type="tel"
                    maxLength={40}
                    placeholder="Mobile (optional)"
                    value={m.phone}
                    onChange={(e) => setMembers((ms) => ms.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMembers((ms) => [...ms, { name: "", gender: "women", email: "", phone: "" }])}
            >
              <Plus className="size-4" /> Add a member
            </Button>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : "Register our family"}
          </Button>
        </form>
      </>
    );
  }

  return (
    <div className="bg-zari flex min-h-dvh flex-col bg-background" style={celebrationStyle(celebration)}>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="panel p-4 sm:p-8">{body}</div>
      </main>
    </div>
  );
}
