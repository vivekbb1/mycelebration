/** Maps host-area sections/tabs (internal values) to clean URL slugs and back. */

const SECTIONS: Record<string, string> = {
  overview: "",
  invitations: "celebration",
  functions: "events",
  guests: "guests",
  wardrobe: "wardrobe",
  setup: "setup",
};

const SUBS: Record<string, Record<string, string>> = {
  guests: {
    list: "list",
    registered: "registered",
    tags: "tags",
    invited: "assign",
    replies: "rsvp",
    broadcast: "broadcast",
    travel: "count",
    arrivals: "logistics",
    rooms: "rooms",
    hosts: "communication",
    tracker: "tracker",
  },
  wardrobe: {
    outfits: "upload",
    manage: "manage",
    import: "bulk-upload",
    feeds: "live-feeds",
    picks: "selection",
    orders: "orders",
    logistics: "delivery",
  },
  setup: {
    boutiques: "boutiques",
    vendors: "vendors",
    budget: "budget",
    fees: "fees",
    hosts: "hosts",
    email: "email",
    look: "wording",
  },
};

const invert = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

/** Parse "/host/<section>/<sub>" splat into internal values. */
export function parseHostPath(splat: string | undefined): { section: string; sub: string | null } {
  const [s = "", sub = ""] = (splat ?? "").split("/").filter(Boolean);
  const section = invert(SECTIONS)[s] ?? (s in SECTIONS ? s : "overview");
  const subValue = sub ? (invert(SUBS[section] ?? {})[sub] ?? null) : null;
  return { section, sub: subValue };
}

/** Build the splat for a section (and optional sub-tab), e.g. "guests/rsvp". */
export function hostSplat(section: string, sub?: string | null): string {
  const s = SECTIONS[section] ?? section;
  if (!s) return "";
  const t = sub ? (SUBS[section]?.[sub] ?? sub) : "";
  return t ? `${s}/${t}` : s;
}

export const HOST_SUB_LABELS: Record<string, string> = {
  list: "List", tags: "Tags", invited: "Assign", replies: "RSVP", broadcast: "Broadcast",
  travel: "Count", arrivals: "Logistics", rooms: "Rooms", hosts: "Communication", tracker: "Tracker",
  outfits: "Upload", manage: "Manage", registered: "Registered", import: "Bulk Upload", feeds: "Live feeds", picks: "Selection", orders: "Orders",
  logistics: "Delivery", boutiques: "Boutiques", vendors: "Vendors", budget: "Budget",
  fees: "Celebration fees", email: "Email", look: "Wording",
};
