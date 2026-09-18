import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailOk = (v: string) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Lets a guest keep their own email and mobile number up to date for the hosts. */
export function GuestContact() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const profile = useQuery({
    queryKey: ["my-contact"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, phone, whatsapp")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (loaded || !profile.data) return;
    setEmail(profile.data.email ?? "");
    setPhone(profile.data.phone ?? profile.data.whatsapp ?? "");
    setLoaded(true);
  }, [loaded, profile.data]);

  const save = async () => {
    if (!profile.data) return;
    if (!emailOk(email.trim())) {
      toast.error("Please check the email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ email: email.trim() || null, phone: phone.trim() || null })
      .eq("id", profile.data.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved — the hosts can reach you on this.");
    await qc.invalidateQueries({ queryKey: ["my-contact"] });
  };

  return (
    <section className="panel mt-12 p-4 sm:p-6">
      <p className="text-eyebrow">Staying in touch</p>
      <h2 className="mt-2 flex items-center gap-2 text-xl">
        <Phone className="size-4 shrink-0 text-primary" /> How we reach you
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Keep these up to date so we can reach you quickly on the day if anything changes.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            maxLength={255}
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-phone">Mobile number</Label>
          <Input
            id="c-phone"
            type="tel"
            maxLength={40}
            value={phone}
            placeholder="+971 50 123 4567"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <Button className="mt-4" disabled={busy || !profile.data} onClick={save}>
        {busy ? "Saving…" : "Save my details"}
      </Button>
    </section>
  );
}
