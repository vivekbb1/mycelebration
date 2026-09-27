import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSelectedEvent } from "@/lib/selected-event";
import { getEmailSettings, saveEmailSettings, sendTestEmail } from "@/lib/email-settings.functions";

type Provider = "lovable" | "resend" | "sendgrid" | "brevo" | "none";

const ROUTES: { value: Provider; title: string; blurb: string }[] = [
  {
    value: "lovable",
    title: "Send with Lovable",
    blurb: "Uses the sender domain set up for this site. Nothing else to manage.",
  },
  {
    value: "resend",
    title: "My own account — Resend",
    blurb: "Paste your Resend key and send from your own verified address.",
  },
  {
    value: "sendgrid",
    title: "My own account — SendGrid",
    blurb: "Your SendGrid key and a verified sender address.",
  },
  {
    value: "brevo",
    title: "My own account — Brevo",
    blurb: "Your Brevo key and a verified sender address.",
  },
  {
    value: "none",
    title: "Don't send anything",
    blurb: "Invitations are handed to your own mail app or WhatsApp instead.",
  },
];

export function HostEmail() {
  const load = useServerFn(getEmailSettings);
  const save = useServerFn(saveEmailSettings);
  const test = useServerFn(sendTestEmail);

  const { inviteId } = useSelectedEvent();
  const settings = useQuery({
    queryKey: ["email-settings", inviteId],
    enabled: Boolean(inviteId),
    queryFn: () => load({ data: { inviteId } }),
  });

  const [provider, setProvider] = useState<Provider>("lovable");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!settings.data?.ok) return;
    setProvider((settings.data.provider as Provider) ?? "lovable");
    setFromEmail(settings.data.fromEmail ?? "");
    setFromName(settings.data.fromName ?? "");
  }, [settings.data]);

  const ready = settings.data?.ready;

  const isReady = (value: Provider) => {
    if (value === "none") return true;
    if (value === "lovable") return Boolean(ready?.lovable);
    return Boolean(ready?.[value]);
  };

  const saving = useMutation({
    mutationFn: () => save({ data: { inviteId, provider, fromEmail, fromName } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save that.");
        return;
      }
      toast.success("Saved — invitations will go out this way.");
      settings.refetch();
    },
    onError: () => toast.error("Couldn't save that."),
  });

  const testing = useMutation({
    mutationFn: () => test({ data: { inviteId, to: testTo.trim() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't send the test.");
        return;
      }
      if (result.sent) toast.success(`Test sent to ${testTo.trim()}.`);
      else toast.error(reasonText(result.reason));
    },
    onError: () => toast.error("Couldn't send the test."),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>How invitations are sent</CardTitle>
          <CardDescription>
            Choose whether we send your invitations and confirmations, or your own email account does.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ROUTES.map((route) => {
            const active = provider === route.value;
            const ok = isReady(route.value);
            return (
              <button
                key={route.value}
                type="button"
                onClick={() => setProvider(route.value)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{route.title}</span>
                  {ok ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <CircleAlert className="h-3 w-3" /> Needs setup
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{route.blurb}</p>
                {active && !ok ? (
                  <p className="mt-2 text-sm text-muted-foreground">{setupHint(route.value)}</p>
                ) : null}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Who the email comes from</CardTitle>
            <CardDescription>
              {provider === "lovable"
                ? "Leave the address blank to use invitations@ your sender domain."
                : "Use an address your email account has verified, or guests won't receive it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="em-name">Name guests see</Label>
              <Input
                id="em-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Our Wedding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em-from">Sender address</Label>
              <Input
                id="em-from"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="invitations@yourdomain.com"
              />
            </div>
            <Button onClick={() => saving.mutate()} disabled={saving.isPending}>
              {saving.isPending ? "Saving…" : "Save sending settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Send yourself a test</CardTitle>
            <CardDescription>Proves the route works before you email 93 guests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@yourdomain.com"
                aria-label="Test recipient"
              />
              <Button
                variant="secondary"
                onClick={() => testing.mutate()}
                disabled={testing.isPending || !testTo.trim()}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                {testing.isPending ? "Sending…" : "Send test"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function setupHint(provider: Provider) {
  if (provider === "lovable") return "Your sender domain isn't set up yet — ask me to set it up and this turns on.";
  const name = provider === "resend" ? "Resend" : provider === "sendgrid" ? "SendGrid" : "Brevo";
  return `Send me your ${name} API key and I'll store it securely — then this route turns on.`;
}

function reasonText(reason?: string) {
  switch (reason) {
    case "lovable_domain_not_set_up":
      return "Your sender domain isn't set up yet, so nothing was sent.";
    case "api_key_missing":
      return "That account's key hasn't been stored yet.";
    case "from_address_missing":
      return "Add a sender address first.";
    case "email_turned_off":
      return "Sending is switched off right now.";
    default:
      return "The email didn't go through — check the sender address is verified.";
  }
}
