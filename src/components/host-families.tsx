import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, Download, Plus, Trash2, Upload, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Wardrobe = "" | "women" | "men";

type MemberDraft = { name: string; email: string; gender: Wardrobe };

const emailOk = (v: string) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const memberSchema = z.object({
  name: z.string().trim().min(2, "Every person needs a name").max(100),
  email: z.string().trim().max(255).refine(emailOk, "Check the email address"),
  gender: z.enum(["", "women", "men"]),
});

const familySchema = z.object({
  name: z.string().trim().min(2, "Give the family a name").max(120),
  members: z.array(memberSchema).min(1, "Add at least one person"),
});

const MEN_WORDS = ["m", "male", "man", "husband", "son", "boy", "menswear", "men"];
const WOMEN_WORDS = ["f", "female", "woman", "wife", "daughter", "girl", "womenswear", "women"];

function wardrobeFrom(value: string): Wardrobe {
  const v = value.trim().toLowerCase();
  if (MEN_WORDS.includes(v)) return "men";
  if (WOMEN_WORDS.includes(v)) return "women";
  return "";
}

/** A short, readable family code: surname + four digits. */
function makeFamilyCode(familyName: string) {
  const words = familyName.replace(/[^a-zA-Z ]/g, " ").trim().split(/\s+/);
  const base = (words[words.length - 1] ?? "FAMILY").toUpperCase().slice(0, 8) || "FAMILY";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeMemberCode(name: string) {
  const base =
    name.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 8) || "GUEST";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

type ParsedRow = { family: string; name: string; email: string; gender: Wardrobe };

/** Turns a grid of cells (spreadsheet or pasted text) into family members. */
function rowsFromGrid(grid: string[][], fallbackFamily: string): ParsedRow[] {
  const clean = grid
    .map((r) => r.map((c) => (c ?? "").toString().trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (clean.length === 0) return [];

  const header = (clean[0] ?? []).map((c) => c.toLowerCase());
  const looksLikeHeader = header.some((c) => ["name", "guest", "guest name"].includes(c));
  const idx = {
    family: header.findIndex((c) => ["family", "household", "family name"].includes(c)),
    name: header.findIndex((c) => ["name", "guest", "guest name"].includes(c)),
    email: header.findIndex((c) => ["email", "email address", "e-mail"].includes(c)),
    gender: header.findIndex((c) =>
      ["wardrobe", "gender", "menswear/womenswear", "male/female"].includes(c),
    ),
  };
  const body = looksLikeHeader ? clean.slice(1) : clean;

  return body
    .map((cells) => {
      const pick = (i: number) => (i >= 0 ? (cells[i] ?? "") : "");
      let family = looksLikeHeader ? pick(idx.family) : "";
      let name = looksLikeHeader ? pick(idx.name) : "";
      let email = looksLikeHeader ? pick(idx.email) : "";
      let gender = wardrobeFrom(looksLikeHeader ? pick(idx.gender) : "");

      if (!looksLikeHeader) {
        // Free-form order: family, name, email, wardrobe — extra cells are ignored.
        const rest = [...cells];
        email = rest.find((c) => /@/.test(c)) ?? "";
        const words = rest.filter((c) => c !== email);
        const marker = words.find((c) => wardrobeFrom(c) !== "");
        if (marker) gender = wardrobeFrom(marker);
        const names = words.filter((c) => c !== marker);
        if (names.length >= 2) {
          family = names[0] ?? "";
          name = names[1] ?? "";
        } else {
          name = names[0] ?? "";
        }
      }

      return {
        family: (family || fallbackFamily).trim(),
        name: name.trim(),
        email: emailOk(email) ? email.trim() : "",
        gender,
      };
    })
    .filter((r) => r.name.length >= 2 && r.family.length >= 2);
}

export function HostFamilies() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [familyName, setFamilyName] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([
    { name: "", email: "", gender: "women" },
    { name: "", email: "", gender: "men" },
  ]);
  const [busy, setBusy] = useState(false);

  const [bulk, setBulk] = useState("");
  const [bulkFamily, setBulkFamily] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const families = useQuery({
    queryKey: ["families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("id, name, code, created_at")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const memberRows = useQuery({
    queryKey: ["family-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, email, gender, family_id, claimed_by");
      if (error) throw error;
      return data;
    },
  });

  const grouped = useMemo(() => {
    return (families.data ?? []).map((f) => ({
      ...f,
      members: (memberRows.data ?? []).filter((m) => m.family_id === f.id),
    }));
  }, [families.data, memberRows.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["families"] }),
      queryClient.invalidateQueries({ queryKey: ["family-members"] }),
      queryClient.invalidateQueries({ queryKey: ["invites"] }),
    ]);
  };

  const setMember = (i: number, patch: Partial<MemberDraft>) =>
    setMembers((list) => list.map((m, n) => (n === i ? { ...m, ...patch } : m)));

  const createFamily = async () => {
    const parsed = familySchema.safeParse({
      name: familyName,
      members: members.filter((m) => m.name.trim() !== ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setBusy(true);
    const created = await createFamilies([
      { family: parsed.data.name, people: parsed.data.members },
    ]);
    setBusy(false);
    if (!created) return;
    toast.success(
      `${parsed.data.name} invited — their family code is ${created.codes[parsed.data.name] ?? ""}.`,
    );
    setFamilyName("");
    setMembers([
      { name: "", email: "", gender: "women" },
      { name: "", email: "", gender: "men" },
    ]);
    await refresh();
  };

  /** Creates any missing families, then their members. Returns family name → code. */
  const createFamilies = async (
    groups: { family: string; people: MemberDraft[] }[],
  ): Promise<{ codes: Record<string, string>; added: number; updated: number } | null> => {
    const existing = new Map((families.data ?? []).map((f) => [f.name.toLowerCase(), f]));
    const toCreate = groups.filter((g) => !existing.has(g.family.toLowerCase()));

    let inserted: { id: string; name: string; code: string }[] = [];
    if (toCreate.length > 0) {
      const { data, error } = await supabase
        .from("families")
        .insert(toCreate.map((g) => ({ name: g.family, code: makeFamilyCode(g.family) })))
        .select("id, name, code");
      if (error) {
        toast.error(error.message);
        return null;
      }
      inserted = data ?? [];
    }

    const byName = new Map<string, { id: string; name: string; code: string }>();
    for (const f of families.data ?? []) byName.set(f.name.toLowerCase(), f);
    for (const f of inserted) byName.set(f.name.toLowerCase(), f);

    // People already on the list are updated (so a filled-in template can be
    // uploaded again to add emails), never duplicated.
    const known = new Map<string, { id: string; email: string | null; gender: string | null }>();
    for (const m of memberRows.data ?? []) {
      if (!m.family_id) continue;
      known.set(`${m.family_id}|${(m.guest_name ?? "").trim().toLowerCase()}`, {
        id: m.id,
        email: m.email,
        gender: m.gender,
      });
    }

    const rows: Record<string, unknown>[] = [];
    const patches: { id: string; email?: string | null; gender?: string | null }[] = [];

    for (const g of groups) {
      const fam = byName.get(g.family.toLowerCase());
      if (!fam) continue;
      for (const p of g.people) {
        const name = p.name.trim();
        const seen = known.get(`${fam.id}|${name.toLowerCase()}`);
        if (seen) {
          const patch: { id: string; email?: string | null; gender?: string | null } = { id: seen.id };
          if (p.email.trim() && p.email.trim() !== seen.email) patch.email = p.email.trim();
          if (p.gender && p.gender !== seen.gender) patch.gender = p.gender;
          if (Object.keys(patch).length > 1) patches.push(patch);
          continue;
        }
        rows.push({
          code: makeMemberCode(name),
          guest_name: name,
          email: p.email.trim() || null,
          gender: p.gender || null,
          household: fam.name,
          family_id: fam.id,
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("invite_codes").insert(rows);
      if (error) {
        toast.error(error.message);
        return null;
      }
    }

    for (const { id, ...patch } of patches) {
      const { error } = await supabase.from("invite_codes").update(patch).eq("id", id);
      if (error) {
        toast.error(error.message);
        return null;
      }
    }

    const codes: Record<string, string> = {};
    for (const g of groups) {
      const fam = byName.get(g.family.toLowerCase());
      if (fam) codes[g.family] = fam.code;
    }
    return { codes, added: rows.length, updated: patches.length };
  };

  /** Spreadsheet of the current guest list (or a blank sample) to fill in and upload back. */
  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const header = ["Family", "Name", "Email", "Wardrobe"];
    const body = grouped.flatMap((f) =>
      f.members.map((m) => [
        f.name,
        m.guest_name ?? "",
        m.email ?? "",
        m.gender === "men" ? "menswear" : m.gender === "women" ? "womenswear" : "",
      ]),
    );
    const sample = [
      ["Mr & Mrs Bhatia", "Vivek Bhatia", "vivek@example.com", "menswear"],
      ["Mr & Mrs Bhatia", "Priya Bhatia", "priya@example.com", "womenswear"],
    ];
    const sheet = XLSX.utils.aoa_to_sheet([header, ...(body.length > 0 ? body : sample)]);
    sheet["!cols"] = [{ wch: 30 }, { wch: 26 }, { wch: 32 }, { wch: 14 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Guest list");
    XLSX.writeFile(book, "guest-list.xlsx");
    toast.success(
      body.length > 0
        ? "Downloaded your guest list — add the emails and upload it back."
        : "Downloaded a blank guest list template.",
    );
  };

  const importRows = async (parsed: ParsedRow[]) => {
    if (parsed.length === 0) {
      toast.error("Nothing to import — check the columns: family, name, email, wardrobe.");
      return;
    }
    const groups = new Map<string, { family: string; people: MemberDraft[] }>();
    for (const r of parsed) {
      const key = r.family.toLowerCase();
      if (!groups.has(key)) groups.set(key, { family: r.family, people: [] });
      groups.get(key)?.people.push({ name: r.name, email: r.email, gender: r.gender });
    }
    setBulkBusy(true);
    const created = await createFamilies([...groups.values()]);
    setBulkBusy(false);
    if (!created) return;
    const famWord = groups.size === 1 ? "family" : "families";
    toast.success(
      `${created.added} added and ${created.updated} updated across ${groups.size} ${famWord}.`,
    );
    setBulk("");
    await refresh();
  };

  const importPasted = async () => {
    const grid = bulk
      .split(/\r?\n/)
      .map((line) => line.split(/[,;\t]/))
      .filter((cells) => cells.some((c) => c.trim() !== ""));
    await importRows(rowsFromGrid(grid, bulkFamily.trim()));
  };

  const importFile = async (file: File) => {
    setBulkBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: "array" });
      const first = book.SheetNames[0];
      const sheet = first ? book.Sheets[first] : undefined;
      if (!sheet) {
        toast.error("That file has no readable sheet.");
        return;
      }
      const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
      setBulkBusy(false);
      await importRows(rowsFromGrid(grid as unknown as string[][], bulkFamily.trim()));
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file.");
    } finally {
      setBulkBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyFamilyInvite = async (name: string, code: string) => {
    const link = `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;
    const message =
      `Dear ${name},\n\nAs our gift, we've put together a wardrobe of festive outfits for the wedding.\n\n` +
      `Open your invitation: ${link}\nYour family code: ${code}\n\n` +
      `One code for the whole family — inside, choose the person first, then their look.\n\nWith love,\nThe hosts`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Family invitation copied — paste it into WhatsApp or email.");
    } catch {
      toast.error(`Couldn't copy. The link is ${link}`);
    }
  };

  const removeFamily = async (id: string, name: string) => {
    const { error } = await supabase.from("families").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} removed from the guest list.`);
    await refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <div className="panel h-fit p-6">
        <h2 className="text-xl">Add a family</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One code for the whole family. Inside, they choose the person first, then that person's
          look.
        </p>

        <div className="mt-5 space-y-2">
          <Label htmlFor="f-name">Family name</Label>
          <Input
            id="f-name"
            maxLength={120}
            value={familyName}
            placeholder="Mr & Mrs Bhatia and Family"
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>

        <div className="mt-5 space-y-4">
          <Label>Who's in the family</Label>
          {members.map((m, i) => (
            <div key={i} className="rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Person {i + 1}</p>
                {members.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove person ${i + 1}`}
                    onClick={() => setMembers((list) => list.filter((_, n) => n !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <Input
                className="mt-2"
                maxLength={100}
                value={m.name}
                placeholder="Full name"
                onChange={(e) => setMember(i, { name: e.target.value })}
              />
              <Input
                className="mt-2"
                maxLength={255}
                value={m.email}
                placeholder="Email (optional)"
                onChange={(e) => setMember(i, { email: e.target.value })}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { value: "", label: "Let them choose" },
                  { value: "women", label: "Womenswear" },
                  { value: "men", label: "Menswear" },
                ].map((opt) => (
                  <Button
                    key={opt.value || "any"}
                    type="button"
                    size="sm"
                    variant={m.gender === opt.value ? "default" : "outline"}
                    onClick={() => setMember(i, { gender: opt.value as Wardrobe })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setMembers((list) => [...list, { name: "", email: "", gender: "" }])}
          >
            <Plus className="size-4" /> Add another person
          </Button>
        </div>

        <Button className="mt-5 w-full" disabled={busy} onClick={createFamily}>
          {busy ? "Creating…" : "Create family invitation"}
        </Button>

        <div className="gold-rule my-6" />

        <h2 className="text-xl">Invite many families at once</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a spreadsheet, or paste rows as{" "}
          <span className="text-foreground">family, name, email, wardrobe</span> — one person per
          line. People sharing a family name share a code.
        </p>

        <Input
          className="mt-3"
          maxLength={120}
          value={bulkFamily}
          placeholder="Family for rows without one (optional)"
          onChange={(e) => setBulkFamily(e.target.value)}
        />

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => void downloadTemplate()}>
            <Download className="size-4" /> Download template
          </Button>
          <Button variant="secondary" disabled={bulkBusy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Upload filled file
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The template holds everyone already on your list — add the missing emails and upload it
          back. Names already there are updated, not duplicated.
        </p>

        <Textarea
          className="mt-3 font-mono text-xs"
          rows={6}
          value={bulk}
          placeholder={
            "Mr & Mrs Bhatia, Vivek Bhatia, vivek@example.com, husband\nMr & Mrs Bhatia, Priya Bhatia, priya@example.com, wife"
          }
          onChange={(e) => setBulk(e.target.value)}
        />
        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={bulkBusy}
          onClick={importPasted}
        >
          {bulkBusy ? "Working…" : "Add pasted rows"}
        </Button>
      </div>

      <div className="panel p-6">
        <h2 className="text-xl">Families ({grouped.length})</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Each family has one code. Share it once and everyone in the family uses it.
        </p>

        <ul className="mt-4 divide-y divide-border">
          {grouped.map((f) => (
            <li key={f.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Users className="size-4 text-primary" />
                    {f.name}
                    <Badge variant="outline">{f.code}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.members.length === 0
                      ? "No one added yet"
                      : f.members
                          .map(
                            (m) =>
                              `${m.guest_name}${
                                m.gender === "men"
                                  ? " (menswear)"
                                  : m.gender === "women"
                                    ? " (womenswear)"
                                    : ""
                              }`,
                          )
                          .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Copy the invitation for ${f.name}`}
                    onClick={() => copyFamilyInvite(f.name, f.code)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => removeFamily(f.id, f.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
          {grouped.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">
              No families yet — add one on the left, or upload your guest spreadsheet.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
