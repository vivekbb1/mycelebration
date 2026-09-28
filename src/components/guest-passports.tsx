import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, FileText, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = {
  id: string;
  person_name: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  nationality: string | null;
  expiry: string | null;
  doc_path: string | null;
};

/** Passport details + a copy of the passport page for each family member, for hotel check-in. */
export function GuestPassports({ household, people }: { household: string; people: string[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const key = ["guest-passports", household];

  const rows = useQuery({
    queryKey: key,
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_passports")
        .select("id, person_name, first_name, last_name, date_of_birth, passport_number, nationality, expiry, doc_path")
        .eq("household", household);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const celebration = useQuery({
    queryKey: ["household-celebration", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data } = await supabase
        .from("invite_codes")
        .select("invite_id")
        .eq("household", household)
        .not("invite_id", "is", null)
        .limit(1)
        .maybeSingle();
      return (data?.invite_id as string | null) ?? null;
    },
  });

  const byName = new Map((rows.data ?? []).map((r) => [r.person_name, r]));

  const save = async (person: string, patch: Partial<Omit<Row, "id" | "person_name">>) => {
    const { error } = await supabase
      .from("guest_passports")
      .upsert({ household, person_name: person, invite_id: celebration.data ?? null, ...patch }, { onConflict: "invite_id,household,person_name" });
    if (error) {
      toast.error(error.message);
      return false;
    }
    await qc.invalidateQueries({ queryKey: key });
    return true;
  };

  const upload = async (person: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Please use a file under 10 MB.");
      return;
    }
    setBusy(person);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!celebration.data) {
      toast.error("We couldn't find this family's celebration.");
      setBusy(null);
      return;
    }
    const path = `${celebration.data}/${household}/${person.replace(/[^\p{L}\p{N}]+/gu, "-")}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("passports").upload(path, file, { upsert: true });
    if (error) {
      setBusy(null);
      toast.error(error.message);
      return;
    }
    const old = byName.get(person)?.doc_path;
    if (await save(person, { doc_path: path })) {
      if (old && old !== path) await supabase.storage.from("passports").remove([old]);
      toast.success(`Passport page saved for ${person}.`);
    }
    setBusy(null);
  };

  const view = async (path: string) => {
    const { data, error } = await supabase.storage.from("passports").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Couldn't open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (!household || people.length === 0) {
    return (
      <div>
        <h3 className="flex items-center gap-2 text-lg">
          <FileText className="size-4 text-primary" /> Passports for check-in
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account isn't linked to a family yet — open your invitation code first, then add
          passports here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="flex items-center gap-2 text-xl">
            <FileText className="size-4 text-primary" /> Passports for check-in (optional)
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Only if your hosts need it — names and details exactly as on the passport, so the hotel
            can check you in quickly. Only your hosts can see these.
          </span>
        </span>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open ? (
      <div className="mt-4 space-y-4">
        {people.map((person) => {
          const r = byName.get(person);
          return (
            <div key={`${person}-${r?.id ?? "new"}`} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{person}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">First name (as on passport)</Label>
                  <Input
                    defaultValue={r?.first_name ?? ""}
                    maxLength={80}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (r?.first_name ?? null)) save(person, { first_name: v });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Last name (as on passport)</Label>
                  <Input
                    defaultValue={r?.last_name ?? ""}
                    maxLength={80}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (r?.last_name ?? null)) save(person, { last_name: v });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Date of birth</Label>
                  <Input
                    type="date"
                    defaultValue={r?.date_of_birth ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      if (v !== (r?.date_of_birth ?? null)) save(person, { date_of_birth: v });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Passport number</Label>
                  <Input
                    defaultValue={r?.passport_number ?? ""}
                    maxLength={30}
                    onBlur={(e) => {
                      const v = e.target.value.trim().toUpperCase() || null;
                      if (v !== (r?.passport_number ?? null)) save(person, { passport_number: v });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nationality</Label>
                  <Input
                    defaultValue={r?.nationality ?? ""}
                    maxLength={60}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (r?.nationality ?? null)) save(person, { nationality: v });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Expiry date</Label>
                  <Input
                    type="date"
                    defaultValue={r?.expiry ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      if (v !== (r?.expiry ?? null)) save(person, { expiry: v });
                    }}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline" disabled={busy === person}>
                  <label className="cursor-pointer">
                    <Upload className="mr-2 size-4" />
                    {busy === person ? "Uploading…" : r?.doc_path ? "Replace passport page" : "Upload passport page"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) upload(person, f);
                      }}
                    />
                  </label>
                </Button>
                {r?.doc_path ? (
                  <Button size="sm" variant="ghost" onClick={() => view(r.doc_path!)}>
                    View uploaded page
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}
