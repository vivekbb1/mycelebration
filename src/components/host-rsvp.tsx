import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Search, X, Clock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Answer = "yes" | "no" | "pending";

const LABEL: Record<Answer, string> = {
  yes: "Coming",
  no: "Can't come",
  pending: "Waiting",
};

const normalise = (value: string | null | undefined): Answer => {
  const v = (value ?? "").toLowerCase();
  if (v === "yes" || v === "attending" || v === "confirmed") return "yes";
  if (v === "no" || v === "declined" || v === "regrets") return "no";
  return "pending";
};

/** RSVP tracking per event: who has confirmed, who declined, who is still quiet. */
export function HostRsvp() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const invites = useQuery({
    queryKey: ["invite-sets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invites").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const families = useQuery({
    queryKey: ["families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("id, name, code, invite_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const guests = useQuery({
    queryKey: ["rsvp-guests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select(
          "id, guest_name, household, family_id, invite_id, claimed_by, rsvp_status, rsvp_note, rsvp_recorded_at",
        )
        .order("guest_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profiles = useQuery({
    queryKey: ["rsvp-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, rsvp_status, rsvp_note, rsvp_updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const answerOf = (g: { claimed_by: string | null; rsvp_status: string | null }): Answer => {
    // A guest's own reply always wins; otherwise we show what a host recorded.
    const profile = g.claimed_by
      ? (profiles.data ?? []).find((p) => p.id === g.claimed_by)
      : undefined;
    const own = normalise(profile?.rsvp_status);
    if (own !== "pending") return own;
    return normalise(g.rsvp_status);
  };

  const setAnswer = async (
    g: { id: string; claimed_by: string | null; guest_name: string },
    answer: Answer,
  ) => {
    setBusy(g.id);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("invite_codes")
      .update({
        rsvp_status: answer,
        rsvp_recorded_at: new Date().toISOString(),
        rsvp_recorded_by: userData.user?.id ?? null,
      })
      .eq("id", g.id);

    // Keep a registered guest's own page in step with what we recorded for them.
    if (!error && g.claimed_by) {
      await supabase
        .from("profiles")
        .update({ rsvp_status: answer, rsvp_updated_at: new Date().toISOString() })
        .eq("id", g.claimed_by);
    }
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${g.guest_name}: ${LABEL[answer].toLowerCase()}`);
    await queryClient.invalidateQueries({ queryKey: ["rsvp-guests"] });
    await queryClient.invalidateQueries({ queryKey: ["rsvp-profiles"] });
    await queryClient.invalidateQueries({ queryKey: ["overview-profiles"] });
    await queryClient.invalidateQueries({ queryKey: ["invites"] });
  };

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const inviteList = [
      ...(invites.data ?? []).map((i) => ({ id: i.id as string | null, name: i.name })),
      { id: null as string | null, name: "Not on an event yet" },
    ];

    return inviteList
      .map((invite) => {
        const famOf = (g: { family_id: string | null; invite_id: string | null }) => {
          const fam = (families.data ?? []).find((f) => f.id === g.family_id);
          return fam ?? null;
        };

        const rows = (guests.data ?? []).filter((g) => {
          const fam = famOf(g);
          const inviteId = g.invite_id ?? fam?.invite_id ?? null;
          return inviteId === invite.id;
        });

        const householdMap = new Map<
          string,
          { name: string; people: typeof rows }
        >();
        for (const g of rows) {
          const key = g.household || famOf(g)?.name || g.guest_name || "Guest";
          const entry = householdMap.get(key) ?? { name: key, people: [] as typeof rows };
          entry.people.push(g);
          householdMap.set(key, entry);
        }

        const households = [...householdMap.values()]
          .map((h) => {
            const answers = h.people.map((p) => answerOf(p));
            const yes = answers.filter((a) => a === "yes").length;
            const no = answers.filter((a) => a === "no").length;
            const waiting = answers.filter((a) => a === "pending").length;
            const status: Answer = waiting > 0 ? "pending" : yes > 0 ? "yes" : "no";
            return { ...h, yes, no, waiting, status };
          })
          .filter(
            (h) =>
              !term ||
              h.name.toLowerCase().includes(term) ||
              h.people.some((p) => (p.guest_name ?? "").toLowerCase().includes(term)),
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        const totals = households.reduce(
          (acc, h) => ({
            yes: acc.yes + h.yes,
            no: acc.no + h.no,
            waiting: acc.waiting + h.waiting,
          }),
          { yes: 0, no: 0, waiting: 0 },
        );

        return { ...invite, households, totals };
      })
      .filter((group) => group.households.length > 0);
  }, [invites.data, families.data, guests.data, profiles.data, search]);

  const all = grouped.reduce(
    (acc, g) => ({
      yes: acc.yes + g.totals.yes,
      no: acc.no + g.totals.no,
      waiting: acc.waiting + g.totals.waiting,
    }),
    { yes: 0, no: 0, waiting: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Confirmed" value={all.yes} />
        <Tile label="Can't come" value={all.no} />
        <Tile label="Still waiting" value={all.waiting} />
      </div>

      <div className="panel p-4 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl">Replies by event</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A guest's own reply shows here the moment they send it. Tap a name to record an
              answer someone gave you by phone.
            </p>
          </div>
          <Search className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <Input
          className="mt-4"
          placeholder="Search a family or a name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {grouped.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No guests on the list yet — add families under Guests first.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {grouped.map((group) => (
              <section key={group.id ?? "none"}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg">{group.name}</h3>
                  <Badge variant="outline">{group.totals.yes} coming</Badge>
                  <Badge variant="outline">{group.totals.no} can't</Badge>
                  <Badge variant="outline">{group.totals.waiting} waiting</Badge>
                </div>

                <ul className="mt-4 space-y-3">
                  {group.households.map((h) => (
                    <li key={`${group.id}-${h.name}`} className="rounded-lg border border-border p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <p className="min-w-0 truncate text-sm">{h.name}</p>
                        <Badge
                          variant={h.status === "pending" ? "outline" : "default"}
                          className="shrink-0"
                        >
                          {h.status === "yes"
                            ? `${h.yes} coming`
                            : h.status === "no"
                              ? "Can't come"
                              : `${h.waiting} to reply`}
                        </Badge>
                      </div>

                      <ul className="mt-3 space-y-2">
                        {h.people.map((p) => {
                          const answer = answerOf(p);
                          return (
                            <li
                              key={p.id}
                              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                            >
                              <p className="min-w-0 truncate text-sm text-muted-foreground">
                                {p.guest_name || "Guest"}
                                {p.claimed_by ? "" : " · not registered"}
                              </p>
                              <div className="flex shrink-0 gap-1">
                                {(["yes", "no", "pending"] as Answer[]).map((option) => (
                                  <button
                                    key={option}
                                    disabled={busy === p.id}
                                    onClick={() => setAnswer(p, option)}
                                    aria-pressed={answer === option}
                                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                      answer === option
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border text-muted-foreground hover:text-primary"
                                    }`}
                                  >
                                    {option === "yes" ? (
                                      <Check className="mr-1 inline size-3" />
                                    ) : option === "no" ? (
                                      <X className="mr-1 inline size-3" />
                                    ) : (
                                      <Clock className="mr-1 inline size-3" />
                                    )}
                                    {LABEL[option]}
                                  </button>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl text-primary">{value}</p>
    </div>
  );
}
