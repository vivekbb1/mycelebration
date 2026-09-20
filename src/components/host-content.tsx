import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { guardedUpdate } from "@/lib/save-guard";
import { SITE_CONTENT_KEY, useSiteContent, type ContentRow } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/**
 * Lets the hosts reword the copy guests see. `only` / `exclude` keep the
 * portal-wide pages (welcome page, site-wide wording) on the platform screen
 * and the celebration pages on the host screen.
 */
export function HostContent({
  only,
  exclude,
  heading = "Wording",
  intro = "Choose a page, then edit its headlines, paragraphs and buttons. Save and guests see the new wording straight away.",
}: {
  only?: string[];
  exclude?: string[];
  heading?: string;
  intro?: string;
} = {}) {
  const queryClient = useQueryClient();
  const { rows: allRows, isLoading } = useSiteContent();
  const rows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (!only || only.includes(r.page_name)) && (!exclude || !exclude.includes(r.page_name)),
      ),
    [allRows, only, exclude],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const row of rows) if (!(row.key in next)) next[row.key] = row.value;
      return next;
    });
  }, [rows]);

  const [page, setPage] = useState<string | null>(null);

  const matched = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.label.toLowerCase().includes(term) ||
        row.value.toLowerCase().includes(term) ||
        row.group_name.toLowerCase().includes(term) ||
        row.page_name.toLowerCase().includes(term),
    );
  }, [rows, filter]);

  const pages = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of matched) map.set(row.page_name, (map.get(row.page_name) ?? 0) + 1);
    return [...map.entries()];
  }, [matched]);

  const activePage = page && pages.some(([name]) => name === page) ? page : (pages[0]?.[0] ?? null);

  const groups = useMemo(() => {
    const map = new Map<string, ContentRow[]>();
    for (const row of matched) {
      if (row.page_name !== activePage) continue;
      const list = map.get(row.group_name) ?? [];
      list.push(row);
      map.set(row.group_name, list);
    }
    return [...map.entries()];
  }, [matched, activePage]);

  const changed = rows.filter((r) => (draft[r.key] ?? r.value) !== r.value);

  const saveAll = async () => {
    if (changed.length === 0) return;
    setBusy(true);
    for (const row of changed) {
      const value = (draft[row.key] ?? row.value).trim();
      if (!value) {
        setBusy(false);
        toast.error(`“${row.label}” can't be empty.`);
        return;
      }
      try {
        await guardedUpdate({
          table: "site_content",
          idColumn: "key",
          id: row.key,
          expectedUpdatedAt: row.updated_at,
          patch: { value },
          label: `“${row.label}”`,
        });
      } catch (e) {
        setBusy(false);
        toast.error(e instanceof Error ? e.message : "Could not save.");
        await queryClient.invalidateQueries({ queryKey: SITE_CONTENT_KEY });
        return;
      }
    }
    setBusy(false);
    toast.success(
      `${changed.length} line${changed.length === 1 ? "" : "s"} updated — guests see the new wording straight away.`,
    );
    await queryClient.invalidateQueries({ queryKey: SITE_CONTENT_KEY });
  };

  const restore = (row: ContentRow) =>
    setDraft((prev) => ({ ...prev, [row.key]: row.default_value }));

  return (
    <div className="space-y-6">
      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search the wording…"
            className="max-w-xs"
          />
          <Button onClick={saveAll} disabled={busy || changed.length === 0}>
            {busy
              ? "Saving…"
              : changed.length === 0
                ? "No changes yet"
                : `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`}
          </Button>
          {changed.length > 0 ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                setDraft(Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<
                  string,
                  string
                >)
              }
            >
              Discard changes
            </Button>
          ) : null}
        </div>

        {pages.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {pages.map(([name, count]) => {
              const active = name === activePage;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setPage(name)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                  }`}
                >
                  {name}
                  <span className={active ? "opacity-80" : "opacity-60"}>{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading the wording…</p> : null}

      {groups.map(([group, list]) => (
        <section key={group} className="panel p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg">{group}</h3>
            <Badge variant="secondary">{list.length}</Badge>
          </div>
          <div className="mt-5 space-y-5">
            {list.map((row) => {
              const value = draft[row.key] ?? row.value;
              const dirty = value !== row.value;
              return (
                <div key={row.key} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={`c-${row.key}`}>{row.label}</Label>
                    {dirty ? <Badge>unsaved</Badge> : null}
                    {value !== row.default_value ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => restore(row)}
                      >
                        <RotateCcw className="size-3" /> Original wording
                      </Button>
                    ) : null}
                  </div>
                  {row.kind === "multiline" ? (
                    <Textarea
                      id={`c-${row.key}`}
                      rows={3}
                      maxLength={1200}
                      value={value}
                      onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`c-${row.key}`}
                      maxLength={300}
                      value={value}
                      onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!isLoading && groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
      ) : null}
    </div>
  );
}
