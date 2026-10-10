import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — My Celebration" },
      { name: "description", content: "Set a new password for your celebration account." },
      { property: "og:title", content: "Choose a new password — My Celebration" },
      { property: "og:description", content: "Set a new password for your celebration account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => s.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  const save = async () => {
    if (pw.length < 6) return void toast.error("Use at least 6 characters.");
    if (pw !== pw2) return void toast.error("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Password changed — you're signed in.");
    navigate({ to: "/" });
  };

  return (
    <main className="bg-zari flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="panel w-full max-w-sm p-6">
        <h1 className="text-2xl">Choose a new password</h1>
        {ready ? (
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Type it again</Label>
              <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy} onClick={save}>
              Save new password
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Checking your link… If nothing happens, open the reset link from your email again.
          </p>
        )}
      </div>
    </main>
  );
}
