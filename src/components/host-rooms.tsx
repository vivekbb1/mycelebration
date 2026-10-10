import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSelectedEvent } from "@/lib/selected-event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type Room = {
  id: string;
  vendor_id: string;
  category: string;
  floor: string | null;
  room_number: string;
  beds: number;
  max_occupancy: number;
  extra_bed_allowed: boolean;
  block_checkin_date: string | null;
  block_checkout_date: string | null;
};
type Assign = { id: string; room_id: string; household: string; guest_name: string; extra_bed: boolean };
type Person = { household: string; guest_name: string };
type Hotel = { id: string; name: string; city: string | null };

const cap = (r: Room) => r.max_occupancy + (r.extra_bed_allowed ? 1 : 0);

export function HostRooms() {
  const { inviteId } = useSelectedEvent();
  const qc = useQueryClient();
  const key = ["rooms", inviteId];

  const q = useQuery({
    queryKey: key,
    enabled: !!inviteId,
    queryFn: async () => {
      const [hotels, rooms, assigns, people, fams, inv, travel] = await Promise.all([
        supabase.from("vendors").select("id, name, city").eq("invite_id", inviteId).eq("category", "hotel").order("name"),
        supabase.from("hotel_rooms").select("*").eq("invite_id", inviteId),
        supabase.from("room_assignments").select("*").eq("invite_id", inviteId),
        supabase.from("invite_codes").select("household, guest_name").eq("invite_id", inviteId),
        supabase.from("families").select("name, travel_need").eq("invite_id", inviteId),
        supabase.from("invites").select("default_travel_need").eq("id", inviteId).maybeSingle(),
        supabase.from("travel_plans").select("household, checkin_date, checkin_time, checkout_date, checkout_time").eq("invite_id", inviteId),
      ]);
      const err = hotels.error || rooms.error || assigns.error || people.error;
      if (err) throw err;
      const def = inv.data?.default_travel_need ?? "none";
      const needs = new Map((fams.data ?? []).map((f) => [f.name, f.travel_need ?? def]));
      const staying = (people.data ?? []).filter(
        (p): p is Person => !!p.household && (needs.get(p.household!) ?? def) !== "none",
      );
      return {
        hotels: (hotels.data ?? []) as Hotel[],
        rooms: ((rooms.data ?? []) as Room[]).sort((a, b) =>
          `${a.floor ?? ""}`.localeCompare(`${b.floor ?? ""}`, undefined, { numeric: true }) ||
          a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
        ),
        assigns: (assigns.data ?? []) as Assign[],
        people: staying,
        travel: new Map((travel.data ?? []).map((t) => [t.household, t])),
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const data = q.data;

  const [hotelFilter, setHotelFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [newHotel, setNewHotel] = useState({ name: "", city: "" });
  const [bulk, setBulk] = useState({
    vendor_id: "", category: "Deluxe", floor: "", from: "", count: "1", beds: "2", max: "2", extra: false,
  });
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{ room_id: string; household: string; guest_name: string }[] | null>(null);

  const assignedKey = useMemo(
    () => new Set((data?.assigns ?? []).map((a) => `${a.household}|${a.guest_name}`)),
    [data],
  );
  const unassigned = (data?.people ?? []).filter((p) => !assignedKey.has(`${p.household}|${p.guest_name}`));
  const categories = [...new Set((data?.rooms ?? []).map((r) => r.category))];

  if (!inviteId) return <p className="text-sm text-muted-foreground">Choose a celebration first.</p>;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading rooms…</p>;
  if (q.error) return <p className="text-sm text-destructive">Couldn't load rooms: {(q.error as Error).message}</p>;
  if (!data) return null;

  const hotelName = (id: string) => data.hotels.find((h) => h.id === id)?.name ?? "Hotel";
  const inRoom = (id: string) => data.assigns.filter((a) => a.room_id === id);

  async function addHotel() {
    if (!newHotel.name.trim()) return;
    const { error } = await supabase.from("vendors").insert({
      name: newHotel.name.trim(), city: newHotel.city || null, category: "hotel", invite_id: inviteId,
    });
    if (error) return void toast.error(error.message);
    setNewHotel({ name: "", city: "" });
    toast.success("Hotel added");
    refresh();
  }

  async function addRooms() {
    const n = Math.max(1, Math.min(200, Number(bulk.count) || 1));
    if (!bulk.vendor_id || !bulk.from.trim()) return void toast.error("Pick a hotel and a first room number");
    const start = Number(bulk.from);
    const rows = Array.from({ length: n }, (_, i) => ({
      invite_id: inviteId,
      vendor_id: bulk.vendor_id,
      category: bulk.category || "Standard",
      floor: bulk.floor || null,
      room_number: Number.isFinite(start) ? String(start + i) : n === 1 ? bulk.from : `${bulk.from}-${i + 1}`,
      beds: Number(bulk.beds) || 1,
      max_occupancy: Number(bulk.max) || 1,
      extra_bed_allowed: bulk.extra,
    }));
    const { error } = await supabase.from("hotel_rooms").insert(rows);
    if (error) return void toast.error(error.message);
    toast.success(`${n} room${n > 1 ? "s" : ""} added`);
    refresh();
  }

  const TEMPLATE_COLS = ["Hotel", "City", "Room category", "Floor", "Room number", "Beds", "Max guests", "Extra bed (yes/no)", "Check-in (YYYY-MM-DD)", "Check-out (YYYY-MM-DD)", "Notes"];

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sample = [
      TEMPLATE_COLS,
      [data?.hotels[0]?.name ?? "Grand Hotel", data?.hotels[0]?.city ?? "Dubai", "Deluxe", "3", "301", 2, 2, "yes", "", "", ""],
      [data?.hotels[0]?.name ?? "Grand Hotel", data?.hotels[0]?.city ?? "Dubai", "Suite", "5", "501", 1, 3, "no", "", "", "Sea view"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = TEMPLATE_COLS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rooms");
    XLSX.writeFile(wb, "rooms-template.xlsx");
  }

  async function uploadRooms(file: File) {
    if (!inviteId) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
      const get = (r: Record<string, unknown>, start: string) => {
        const k = Object.keys(r).find((x) => x.toLowerCase().startsWith(start.toLowerCase()));
        const v = k ? r[k] : "";
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v ?? "").trim();
      };
      const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
      const hotels = new Map((data?.hotels ?? []).map((h) => [h.name.trim().toLowerCase(), h.id]));
      const existing = new Set((data?.rooms ?? []).map((r) => `${r.vendor_id}|${r.room_number.trim().toLowerCase()}`));
      const toInsert: Record<string, unknown>[] = [];
      let skipped = 0;
      for (const r of rows) {
        const hotel = get(r, "Hotel");
        const num = get(r, "Room number");
        if (!hotel || !num) { skipped++; continue; }
        let vid = hotels.get(hotel.toLowerCase());
        if (!vid) {
          const { data: v, error } = await supabase.from("vendors")
            .insert({ name: hotel, city: get(r, "City") || null, category: "hotel", invite_id: inviteId })
            .select("id").single();
          if (error) throw error;
          vid = v.id;
          hotels.set(hotel.toLowerCase(), vid);
        }
        const dup = `${vid}|${num.toLowerCase()}`;
        if (existing.has(dup)) { skipped++; continue; }
        existing.add(dup);
        const beds = Math.max(1, Number(get(r, "Beds")) || 1);
        toInsert.push({
          invite_id: inviteId,
          vendor_id: vid,
          category: get(r, "Room category") || "Standard",
          floor: get(r, "Floor") || null,
          room_number: num,
          beds,
          max_occupancy: Math.max(1, Number(get(r, "Max guests")) || beds),
          extra_bed_allowed: /^(y|yes|true|1)$/i.test(get(r, "Extra bed")),
          block_checkin_date: date(get(r, "Check-in")),
          block_checkout_date: date(get(r, "Check-out")),
          notes: get(r, "Notes") || null,
        });
      }
      if (toInsert.length) {
        const { error } = await supabase.from("hotel_rooms").insert(toInsert as never);
        if (error) throw error;
      }
      toast.success(`${toInsert.length} room${toInsert.length === 1 ? "" : "s"} added${skipped ? ` · ${skipped} skipped (blank or already there)` : ""}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that file");
    }
  }

  async function removeRoom(id: string) {
    if (!confirm("Remove this room and its guest assignments?")) return;
    const { error } = await supabase.from("hotel_rooms").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  }

  async function toggleExtra(r: Room) {
    const { error } = await supabase.from("hotel_rooms").update({ extra_bed_allowed: !r.extra_bed_allowed }).eq("id", r.id);
    if (error) return void toast.error(error.message);
    refresh();
  }

  async function assign(room: Room, p: Person) {
    const used = inRoom(room.id).length;
    const { error } = await supabase.from("room_assignments").insert({
      invite_id: inviteId, room_id: room.id, household: p.household, guest_name: p.guest_name,
      extra_bed: used >= room.max_occupancy,
    });
    if (error) return void toast.error(error.message.includes("full") ? "That room is full" : error.message);
    refresh();
  }

  async function setBlock(vendorId: string, field: "block_checkin_date" | "block_checkout_date", value: string) {
    const { error } = await supabase.from("hotel_rooms").update(field === "block_checkin_date" ? { block_checkin_date: value || null } : { block_checkout_date: value || null }).eq("vendor_id", vendorId).eq("invite_id", inviteId!);
    if (error) return void toast.error(error.message);
    toast.success("Dates saved for every room at this hotel");
    refresh();
  }

  async function move(a: Assign, roomId: string) {
    const room = data!.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const { error } = await supabase
      .from("room_assignments")
      .update({ room_id: roomId, extra_bed: inRoom(roomId).length >= room.max_occupancy })
      .eq("id", a.id);
    if (error) return void toast.error(error.message.includes("full") ? "That room is full" : error.message);
    toast.success(`${a.guest_name} moved to room ${room.room_number}`);
    refresh();
  }

  async function unassign(id: string) {
    const { error } = await supabase.from("room_assignments").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  }

  function buildSuggestion() {
    const free = new Map(data!.rooms.map((r) => [r.id, r.max_occupancy - inRoom(r.id).length]));
    const byFam = new Map<string, Person[]>();
    unassigned.forEach((p) => byFam.set(p.household, [...(byFam.get(p.household) ?? []), p]));
    const fams = [...byFam.entries()].sort((a, b) => b[1].length - a[1].length);
    const out: { room_id: string; household: string; guest_name: string }[] = [];
    // Pass 1: keep each family together in the smallest room that fits.
    const leftovers: Person[] = [];
    for (const [, members] of fams) {
      const fit = data!.rooms
        .filter((r) => (free.get(r.id) ?? 0) >= members.length)
        .sort((a, b) => (free.get(a.id) ?? 0) - (free.get(b.id) ?? 0))[0];
      if (fit) {
        members.forEach((m) => out.push({ room_id: fit.id, ...m }));
        free.set(fit.id, (free.get(fit.id) ?? 0) - members.length);
      } else leftovers.push(...members);
    }
    // Pass 2: fill remaining beds, fullest-first, to maximise occupancy.
    for (const m of leftovers) {
      const r = data!.rooms
        .filter((x) => (free.get(x.id) ?? 0) > 0)
        .sort((a, b) => (free.get(a.id) ?? 0) - (free.get(b.id) ?? 0))[0];
      if (!r) break;
      out.push({ room_id: r.id, ...m });
      free.set(r.id, (free.get(r.id) ?? 0) - 1);
    }
    setSuggest(out);
  }

  async function saveSuggestion() {
    if (!suggest?.length) return void setSuggest(null);
    const { error } = await supabase
      .from("room_assignments")
      .insert(suggest.map((s) => ({ ...s, invite_id: inviteId })));
    if (error) return void toast.error(error.message);
    toast.success(`${suggest.length} guests placed`);
    setSuggest(null);
    refresh();
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Hotel", "Floor", "Room", "Category", "Guest", "Family", "Extra bed", "Check-in", "Check-out"].join(",")];
    for (const r of filteredRooms) {
      const occ = inRoom(r.id);
      if (!occ.length) lines.push([hotelName(r.vendor_id), r.floor, r.room_number, r.category, "", "", "", "", ""].map(esc).join(","));
      for (const a of occ) {
        const t = data!.travel.get(a.household);
        const cin = t?.checkin_date ? [t.checkin_date, t.checkin_time].filter(Boolean).join(" ") : r.block_checkin_date ?? "";
        const cout = t?.checkout_date ? [t.checkout_date, t.checkout_time].filter(Boolean).join(" ") : r.block_checkout_date ?? "";
        lines.push([
          hotelName(r.vendor_id), r.floor, r.room_number, r.category, a.guest_name, a.household,
          a.extra_bed ? "Yes" : "",
          cin,
          cout,
        ].map(esc).join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rooming-list.csv";
    a.click();
  }

  const filteredRooms = data.rooms.filter(
    (r) => (!hotelFilter || r.vendor_id === hotelFilter) && (!catFilter || r.category === catFilter),
  );
  const totalBeds = data.rooms.reduce((s, r) => s + r.max_occupancy, 0);
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Rooms" value={data.rooms.length} />
        <Stat label="Beds" value={totalBeds} />
        <Stat label="Guests placed" value={data.assigns.length} />
        <Stat label="Still to place" value={unassigned.length} />
      </div>

      <section className="panel space-y-3 p-4 sm:p-6">
        <h3 className="text-lg">Hotels</h3>
        <div className="flex flex-wrap gap-2">
          {data.hotels.map((h) => <Badge key={h.id} variant="outline">{h.name}{h.city ? ` · ${h.city}` : ""}</Badge>)}
          {!data.hotels.length && <p className="text-sm text-muted-foreground">No hotels yet. Add one below.</p>}
        </div>
        {data.hotels.some((h) => data.rooms.some((r) => r.vendor_id === h.id)) && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Block dates: check-in and check-out for every room at a hotel. A family's own travel dates take priority.</p>
            {data.hotels.filter((h) => data.rooms.some((r) => r.vendor_id === h.id)).map((h) => {
              const first = data.rooms.find((r) => r.vendor_id === h.id)!;
              return (
                <div key={h.id} className="flex flex-wrap items-end gap-2 text-sm">
                  <span className="w-40 truncate pb-2">{h.name}</span>
                  <div><Label>Check-in</Label><Input type="date" className="w-40" defaultValue={first.block_checkin_date ?? ""} onBlur={(e) => e.target.value !== (first.block_checkin_date ?? "") && setBlock(h.id, "block_checkin_date", e.target.value)} /></div>
                  <div><Label>Check-out</Label><Input type="date" className="w-40" defaultValue={first.block_checkout_date ?? ""} onBlur={(e) => e.target.value !== (first.block_checkout_date ?? "") && setBlock(h.id, "block_checkout_date", e.target.value)} /></div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <Input className="w-56" placeholder="Hotel name" value={newHotel.name} onChange={(e) => setNewHotel({ ...newHotel, name: e.target.value })} />
          <Input className="w-40" placeholder="City" value={newHotel.city} onChange={(e) => setNewHotel({ ...newHotel, city: e.target.value })} />
          <Button onClick={addHotel}>Add hotel</Button>
        </div>
      </section>

      <section className="panel space-y-3 p-4 sm:p-6">
        <h3 className="text-lg">Add rooms</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><Label>Hotel</Label>
            <select className={`${sel} w-full`} value={bulk.vendor_id} onChange={(e) => setBulk({ ...bulk, vendor_id: e.target.value })}>
              <option value="">Choose…</option>
              {data.hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select></div>
          <div><Label>Room category</Label><Input value={bulk.category} onChange={(e) => setBulk({ ...bulk, category: e.target.value })} /></div>
          <div><Label>Floor</Label><Input value={bulk.floor} onChange={(e) => setBulk({ ...bulk, floor: e.target.value })} /></div>
          <div><Label>First room number</Label><Input value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} /></div>
          <div><Label>How many rooms</Label><Input type="number" min={1} value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: e.target.value })} /></div>
          <div><Label>Beds</Label><Input type="number" min={1} value={bulk.beds} onChange={(e) => setBulk({ ...bulk, beds: e.target.value })} /></div>
          <div><Label>Max guests</Label><Input type="number" min={1} value={bulk.max} onChange={(e) => setBulk({ ...bulk, max: e.target.value })} /></div>
          <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={bulk.extra} onCheckedChange={(v) => setBulk({ ...bulk, extra: !!v })} />Extra bed allowed</label>
        </div>
        <Button onClick={addRooms}>Add rooms</Button>
        <div className="border-t border-border pt-3">
          <p className="text-sm font-medium">Bulk upload</p>
          <p className="text-xs text-muted-foreground">Download the template, fill one row per room, then upload it. New hotels are added automatically; rooms already listed are skipped.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}>Download template</Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                Upload rooms
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadRooms(f);
                  }}
                />
              </label>
            </Button>
          </div>
        </div>
      </section>

      <section className="panel space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-lg">Rooming list</h3>
          <select className={sel} value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)}>
            <option value="">All hotels</option>
            {data.hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select className={sel} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button variant="outline" onClick={buildSuggestion} disabled={!unassigned.length || !data.rooms.length}>Suggest fill</Button>
          <Button variant="outline" onClick={exportCsv}>Download list</Button>
        </div>

        {suggest && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Suggested placement ({suggest.length} guests)</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
              {suggest.map((s) => {
                const r = data.rooms.find((x) => x.id === s.room_id)!;
                return <li key={`${s.household}|${s.guest_name}`}>{s.guest_name} ({s.household}) → {hotelName(r.vendor_id)} room {r.room_number}</li>;
              })}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={saveSuggestion}>Save placement</Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggest(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {!filteredRooms.length && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredRooms.map((r) => {
            const occ = inRoom(r.id);
            const full = occ.length >= cap(r);
            const fams = [...new Set(occ.map((a) => a.household))];
            return (
              <div key={r.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">Room {r.room_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {hotelName(r.vendor_id)} · {r.category}{r.floor ? ` · Floor ${r.floor}` : ""} · {r.beds} bed{r.beds > 1 ? "s" : ""}
                    </p>
                    {(r.block_checkin_date || r.block_checkout_date) && (
                      <p className="text-xs text-muted-foreground">{r.block_checkin_date ?? "?"} → {r.block_checkout_date ?? "?"}</p>
                    )}
                  </div>
                  <Badge variant={occ.length > r.max_occupancy ? "destructive" : full ? "default" : "outline"}>
                    {occ.length} / {r.max_occupancy}{r.extra_bed_allowed ? " + extra" : ""}
                  </Badge>
                </div>
                {fams.length > 1 && <p className="mt-1 text-xs text-muted-foreground">Shared by {fams.length} families</p>}
                <ul className="mt-2 space-y-1 text-sm">
                  {occ.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span>{a.guest_name} <span className="text-muted-foreground">· {a.household}</span>{a.extra_bed && <Badge variant="outline" className="ml-1">Extra bed</Badge>}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <select
                          aria-label={`Move ${a.guest_name}`}
                          className="h-7 max-w-28 rounded border border-input bg-background px-1 text-xs"
                          value=""
                          onChange={(e) => e.target.value && move(a, e.target.value)}
                        >
                          <option value="">Move to…</option>
                          {data.rooms.filter((x) => x.id !== r.id && inRoom(x.id).length < cap(x)).map((x) => (
                            <option key={x.id} value={x.id}>{hotelName(x.vendor_id)} · {x.room_number}</option>
                          ))}
                        </select>
                        <button className="text-xs text-muted-foreground underline" onClick={() => unassign(a.id)}>Remove</button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!full && <Button size="sm" variant="outline" onClick={() => setOpenRoom(openRoom === r.id ? null : r.id)}>Add guest</Button>}
                  <Button size="sm" variant="ghost" onClick={() => toggleExtra(r)}>{r.extra_bed_allowed ? "No extra bed" : "Allow extra bed"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeRoom(r.id)}>Delete room</Button>
                </div>
                {openRoom === r.id && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-auto rounded border border-border p-2 text-sm">
                    {!unassigned.length && <p className="text-muted-foreground">Everyone staying is placed.</p>}
                    {unassigned.map((p) => (
                      <button key={`${p.household}|${p.guest_name}`} className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => assign(r, p)}>
                        {p.guest_name} <span className="text-muted-foreground">· {p.household}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {unassigned.length > 0 && (
        <section className="panel p-4 sm:p-6">
          <h3 className="text-lg">Still to place</h3>
          <p className="mt-1 text-sm text-muted-foreground">Guests in families set to "Stay only" or "Stay + pickup".</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unassigned.map((p) => <Badge key={`${p.household}|${p.guest_name}`} variant="outline">{p.guest_name} · {p.household}</Badge>)}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl">{value}</p>
    </div>
  );
}
