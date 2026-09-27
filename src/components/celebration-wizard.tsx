import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeatures } from "@/lib/features";
import { useSelectedEvent } from "@/lib/selected-event";

const STEPS = ["Name", "Email sender", "Logistics", "Package"] as const;

/** Sets up a new celebration in one go: name, sender, logistics, package and add-ons. */
export function CelebrationWizard() {
  const qc = useQueryClient();
  const selected = useSelectedEvent();
  const { isPlatformAdmin } = useFeatures();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelAddress, setHotelAddress] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamWhatsapp, setTeamWhatsapp] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [planId, setPlanId] = useState("free");
  const [addonIds, setAddonIds] = useState<string[]>([]);

  const catalogue = useQuery({
    queryKey: ["wizard-catalogue", inviteId],
    enabled: step === 3 && !!inviteId,
    queryFn: async () => {
      const [plans, addons] = await Promise.all([
        supabase.from("plans").select("id, name, blurb").order("sort_order"),
        supabase.from("addons").select("id, name, blurb").order("sort_order"),
      ]);
      return { plans: plans.data ?? [], addons: addons.data ?? [] };
    },
  });

  const reset = () => {
    setStep(0);
    setInviteId(null);
    [setName, setNote, setFromName, setFromEmail, setHotelName, setHotelAddress, setTeamName, setTeamWhatsapp, setTeamEmail].forEach((f) => f(""));
    setPlanId("free");
    setAddonIds([]);
  };

  async function next() {
    setBusy(true);
    try {
      if (step === 0) {
        const clean = name.trim();
        if (clean.length < 2) throw new Error("Give the celebration a name first.");
        const { data, error } = await supabase
          .from("invites")
          .insert({ name: clean, note: note.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        setInviteId(data.id);
        await qc.refetchQueries({ queryKey: ["invite-sets"] });
        selected.setInviteId(data.id);
        setFromName(clean);
      } else if (step === 1 && inviteId) {
        if (fromEmail.trim() || fromName.trim()) {
          const { error } = await supabase.from("celebration_email_settings").upsert({
            invite_id: inviteId,
            provider: "lovable",
            from_name: fromName.trim() || null,
            from_email: fromEmail.trim() || null,
          });
          if (error) throw error;
        }
      } else if (step === 2 && inviteId) {
        const { error } = await supabase.from("logistics").insert({
          invite_id: inviteId,
          singleton: true,
          hotel_name: hotelName.trim() || null,
          hotel_address: hotelAddress.trim() || null,
          team_name: teamName.trim() || null,
          team_whatsapp: teamWhatsapp.trim() || null,
          team_email: teamEmail.trim() || null,
        });
        if (error) throw error;
      } else if (step === 3 && inviteId) {
        if (isPlatformAdmin) {
          const { error } = await supabase
            .from("celebration_subscriptions")
            .upsert({ invite_id: inviteId, plan_id: planId, status: "active" });
          if (error) throw error;
          if (addonIds.length) {
            const { error: e2 } = await supabase
              .from("celebration_addons")
              .insert(addonIds.map((addon_id) => ({ invite_id: inviteId, addon_id })));
            if (e2) throw e2;
          }
        } else if (planId !== "free" || addonIds.length) {
          const { data: u } = await supabase.auth.getUser();
          const { error } = await supabase.from("plan_requests").insert({
            user_id: u.user!.id,
            invite_id: inviteId,
            plan_id: planId,
            addon_ids: addonIds,
          });
          if (error) throw error;
        }
        qc.invalidateQueries();
        toast.success(
          isPlatformAdmin || (planId === "free" && !addonIds.length)
            ? "Celebration is set up — add its events and guests next."
            : "Celebration is set up. Your package request is waiting for approval.",
        );
        reset();
        return;
      }
      setStep((s) => s + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that step.");
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, placeholder = "") => (
    <label className="block text-sm">
      {label}
      <Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="mt-1" />
    </label>
  );

  return (
    <div className="panel h-fit p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <Mail className="size-4 text-primary" /> Set up a celebration
      </h2>
      <ol className="mt-3 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-2.5 py-1 ${i === step ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {i < step ? <Check className="mr-1 inline size-3" /> : `${i + 1}. `}
            {s}
          </li>
        ))}
      </ol>

      <div className="mt-5 space-y-3">
        {step === 0 && (
          <>
            {field("Name", name, setName, "Kush & Khyati")}
            {field("A note for your team (optional)", note, setNote, "Bride's side, November")}
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">Who invitations and reminders come from. Leave blank to use the platform sender.</p>
            {field("Sender name", fromName, setFromName)}
            {field("Reply-to / sender email (optional)", fromEmail, setFromEmail, "hello@yourdomain.com")}
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground">Guests see this on their arrival details. You can add a timeline later.</p>
            {field("Hotel", hotelName, setHotelName)}
            {field("Hotel address", hotelAddress, setHotelAddress)}
            {field("Team contact name", teamName, setTeamName)}
            {field("Team WhatsApp", teamWhatsapp, setTeamWhatsapp)}
            {field("Team email", teamEmail, setTeamEmail)}
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-sm text-muted-foreground">
              {isPlatformAdmin
                ? "As the platform owner this switches on straight away."
                : "Anything beyond Free is sent for approval."}
            </p>
            <div className="space-y-2">
              {(catalogue.data?.plans ?? []).map((p) => (
                <label key={p.id} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="wiz-plan" checked={planId === p.id} onChange={() => setPlanId(p.id)} className="mt-1" />
                  <span>
                    {p.name}
                    {p.blurb && <span className="block text-xs text-muted-foreground">{p.blurb}</span>}
                  </span>
                </label>
              ))}
            </div>
            {(catalogue.data?.addons ?? []).length > 0 && (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-xs text-muted-foreground">Add-ons</p>
                {(catalogue.data?.addons ?? []).map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={addonIds.includes(a.id)}
                      onChange={(e) =>
                        setAddonIds((l) => (e.target.checked ? [...l, a.id] : l.filter((x) => x !== a.id)))
                      }
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" disabled={busy} onClick={next}>
            {step === 0 ? "Create and continue" : step === 3 ? "Finish" : "Save and continue"}
          </Button>
          {step > 0 && step < 3 && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep((s) => s + 1)}>
              Skip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
