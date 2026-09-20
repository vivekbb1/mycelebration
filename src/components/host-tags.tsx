import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelectedEvent } from "@/lib/selected-event";
import { splitTags, normaliseTag } from "@/lib/tags";

/**
 * Manage the list of tags used on the guest list: add, rename, delete,
 * and tidy several at once. Renaming or deleting a tag also updates every
 * guest carrying it, so the guest list never keeps a stale tag.
 */
export function HostTags() {
  const qc = useQueryClient();
  const { inviteId } = useSelectedEvent();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const tags = useQuery({
    queryKey: ["guest-tags", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_tags")
        .select("id, name, invite_id")
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((t) => !inviteId || !t.invite_id || t.invite_id === inviteId);
    },
  });

  const guests = useQuery({
    queryKey: ["tag-guests", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household, tags, invite_id")
        .order("household");
      if (error) throw error;
      return (data ?? []).filter((g) => !inviteId || g.invite_id === inviteId);
    },
  });

  /** The hosts helping with this celebration, for linking tags to people. */
  const hosts = useQuery({
    queryKey: ["tag-hosts-list"],
    queryFn: async () => {
      const roles = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (roles.error) throw roles.error;
      const ids = (roles.data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as { id: string; name: string }[];
      const people = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      if (people.error) throw people.error;
      return ids.map((id) => {
        const p = (people.data ?? []).find((row) => row.id === id);
        return { id, name: (p?.full_name ?? "").trim() || (p?.email ?? "") || "Host" };
      });
    },
  });

  const tagHosts = useQuery({
    queryKey: ["guest-tag-hosts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("guest_tag_hosts").select("id, tag_id, host_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  /** How many families carry each tag. */
  const usage = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of guests.data ?? []) {
      const family = (g.household ?? "").trim() || (g.guest_name ?? "").trim();
      for (const t of splitTags(g.tags)) {
        const set = map.get(t) ?? new Set<string>();
        set.add(family);
        map.set(t, set);
      }
    }
    return map;
  }, [guests.data]);

  const known = useMemo(
    () => new Set((tags.data ?? []).map((t) => t.name.toLowerCase())),
    [tags.data],
  );

  /** Tags typed straight onto a guest that aren't in this list yet. */
  const loose = useMemo(
    () => [...usage.keys()].filter((t) => !known.has(t)).sort((a, b) => a.localeCompare(b)),
    [usage, known],
  );

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["guest-tags"] });
    await qc.invalidateQueries({ queryKey: ["tag-guests"] });
    await qc.invalidateQueries({ queryKey: ["guest-tag-hosts"] });
    await qc.invalidateQueries({ queryKey: ["invites-households"] });
    await qc.invalidateQueries({ queryKey: ["invites"] });
    await qc.invalidateQueries({ queryKey: ["relations-tag-hosts"] });
    await qc.invalidateQueries({ queryKey: ["workload-tag-hosts"] });
  };

  /** Put a loose tag into the list so hosts can be linked to it. */
  const adoptTag = async (name: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("guest_tags")
      .insert({ name, invite_id: inviteId ?? null })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    await refresh();
    return data?.id ?? null;
  };

  /** Link or unlink a host to a tag. Everyone with the tag is theirs to look after. */
  const toggleHost = async (tagId: string | null, tagName: string, hostId: string) => {
    setBusy(true);
    let id = tagId;
    if (!id) id = await adoptTag(tagName);
    if (!id) {
      setBusy(false);
      return;
    }
    const existing = (tagHosts.data ?? []).find((r) => r.tag_id === id && r.host_id === hostId);
    const { error } = existing
      ? await supabase.from("guest_tag_hosts").delete().eq("id", existing.id)
      : await supabase.from("guest_tag_hosts").insert({ tag_id: id, host_id: hostId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const addTags = async (raw: string) => {
    const names = [
      ...new Set(
        raw
          .split(/[,#\n]+/)
          .map((t) => normaliseTag(t))
          .filter(Boolean),
      ),
    ].filter((t) => !known.has(t));
    if (names.length === 0) {
      toast.error("Nothing new to add.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("guest_tags")
      .insert(names.map((name) => ({ name, invite_id: inviteId ?? null })));
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    toast.success(`Added ${names.length} tag${names.length === 1 ? "" : "s"}.`);
    await refresh();
  };

  /** Write a tag list back onto one guest. */
  const writeGuest = async (id: string, next: string[]) => {
    const { error } = await supabase
      .from("invite_codes")
      .update({ tags: next.length > 0 ? next.join(", ") : null })
      .eq("id", id);
    if (error) throw new Error(error.message);
  };

  const renameTag = async (id: string | null, from: string, to: string) => {
    const name = normaliseTag(to);
    if (!name || name === from) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    try {
      if (id) {
        const { error } = await supabase.from("guest_tags").update({ name }).eq("id", id);
        if (error) throw new Error(error.message);
      } else if (!known.has(name)) {
        const { error } = await supabase
          .from("guest_tags")
          .insert({ name, invite_id: inviteId ?? null });
        if (error) throw new Error(error.message);
      }
      for (const g of guests.data ?? []) {
        const current = splitTags(g.tags);
        if (!current.includes(from)) continue;
        const next = [...new Set(current.map((t) => (t === from ? name : t)))];
        await writeGuest(g.id, next);
      }
      toast.success(`#${from} is now #${name}.`);
      setRenaming(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename that tag.");
    }
    setBusy(false);
  };

  const deleteTags = async (names: string[]) => {
    if (names.length === 0) return;
    setBusy(true);
    try {
      const ids = (tags.data ?? []).filter((t) => names.includes(t.name.toLowerCase())).map((t) => t.id);
      if (ids.length > 0) {
        const { error } = await supabase.from("guest_tags").delete().in("id", ids);
        if (error) throw new Error(error.message);
      }
      for (const g of guests.data ?? []) {
        const current = splitTags(g.tags);
        const next = current.filter((t) => !names.includes(t));
        if (next.length === current.length) continue;
        await writeGuest(g.id, next);
      }
      toast.success(`Removed ${names.length} tag${names.length === 1 ? "" : "s"}.`);
      setPicked(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that tag.");
    }
    setBusy(false);
  };

  const rows = useMemo(() => {
    const list = (tags.data ?? []).map((t) => ({
      id: t.id as string | null,
      name: t.name.toLowerCase(),
      families: usage.get(t.name.toLowerCase())?.size ?? 0,
    }));
    for (const t of loose) list.push({ id: null, name: t, families: usage.get(t)?.size ?? 0 });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [tags.data, loose, usage]);

  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Tag className="size-4 text-primary" /> Manage tags
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tags are your own labels for guests — bride's side, top table, overseas. Add them
          here, then put them on families under Assign. Renaming or removing a tag here
          updates every guest carrying it.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            className="max-w-sm"
            placeholder="#bride-side #top-table…"
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void addTags(draft);
            }}
          />
          <Button size="sm" disabled={busy || !draft.trim()} onClick={() => void addTags(draft)}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>
      </section>

      <section className="panel p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-sm text-muted-foreground">
            {rows.length} tag{rows.length === 1 ? "" : "s"} · {picked.size} picked
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || picked.size === 0}
              onClick={() => void deleteTags([...picked])}
            >
              <Trash2 className="mr-1 size-3.5" /> Delete picked
            </Button>
            {picked.size > 0 ? (
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-4 font-normal text-muted-foreground">
                  <Checkbox
                    aria-label="Pick every tag"
                    checked={rows.length > 0 && rows.every((r) => picked.has(r.name))}
                    onCheckedChange={(on) =>
                      setPicked(on ? new Set(rows.map((r) => r.name)) : new Set())
                    }
                  />
                </th>
                <th className="p-4 font-normal text-muted-foreground">Tag</th>
                <th className="p-4 font-normal text-muted-foreground">On how many families</th>
                <th className="p-4 font-normal text-muted-foreground">Looked after by</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <Checkbox
                      aria-label={`Pick #${r.name}`}
                      checked={picked.has(r.name)}
                      onCheckedChange={() =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.name)) next.delete(r.name);
                          else next.add(r.name);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="p-4">
                    {renaming === r.name ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 w-40 text-xs"
                          autoFocus
                          value={renameDraft}
                          maxLength={40}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setRenaming(null);
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            void renameTag(r.id, r.name, renameDraft);
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void renameTag(r.id, r.name, renameDraft)}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        #{r.name}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground">{r.families}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {r.id ? "Yes" : "Typed on a guest"}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setRenaming(r.name);
                          setRenameDraft(r.name);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void deleteTags([r.name])}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="p-4 text-sm text-muted-foreground" colSpan={5}>
                    No tags yet — add your first one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
