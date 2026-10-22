import { ExternalLink, Minus } from "lucide-react";
import { SubstitutionNote, useLatestSubstitutions } from "@/components/substitution-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { memberLook } from "@/lib/outfit-pick-progress";
import { wardrobeLabel } from "@/lib/wardrobe-options";

type Person = { id: string; guest_name: string; household: string | null; claimed_by: string | null; gender: string | null };
type Outfit = { title: string; designer: string | null; notes: string | null; image_url: string | null; images: unknown; boutique_url: string | null; event_id: string | null };
type Choice = { id: string; guest_id: string; guest_name: string | null; member_code_id?: string | null; status: string; build_garment: string | null; build_size: string | null; size_choice: string | null; outfit: Outfit | null };

function imageUrl(src: string) {
  if (src.startsWith("/api/public/outfit-image/")) return `${src.split("?")[0]}?w=240`;
  if (/^https:\/\/[^/]*pernia/i.test(src)) return `/api/public/shop-image?w=240&u=${encodeURIComponent(src)}`;
  return src;
}

export function FamilyWardrobeChoices({ people, events, choices, loading }: {
  people: Person[];
  events: Array<{ id: string; name: string; outfit_selection: boolean | null }>;
  choices: Choice[];
  loading: boolean;
}) {
  const subs = useLatestSubstitutions(choices.map((c) => c.id));
  const columns = events.filter((e) => e.outfit_selection !== false || choices.some((c) => c.outfit?.event_id === e.id));
  const looks = choices.map((c) => ({ ...c, outfits: c.outfit }));
  if (loading) return <p className="mt-4 text-sm text-muted-foreground">Loading…</p>;
  if (!columns.length) return <p className="mt-4 text-sm text-muted-foreground">No outfit selection events for this family.</p>;
  return (
    <div className="mt-4 max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="min-w-40 px-3 py-3 font-medium">Family member</th>
            {columns.map((e) => <th key={e.id} scope="col" className="min-w-64 px-3 py-3 font-medium text-primary">{e.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-4 align-top font-medium">
                <p>{person.guest_name}</p>
                {person.gender ? <p className="mt-1 text-xs font-normal text-muted-foreground">{wardrobeLabel(person.gender)}</p> : null}
              </th>
              {columns.map((event) => {
                const choice = memberLook(person, people, looks, event.id);
                const outfit = choice?.outfit;
                const image = outfit?.image_url || (Array.isArray(outfit?.images) && typeof outfit.images[0] === "string" ? outfit.images[0] : null);
                const shop = outfit?.boutique_url && /^https?:\/\//i.test(outfit.boutique_url) ? outfit.boutique_url : null;
                const confirmed = Boolean(choice && ((choice.build_garment && choice.build_size) || choice.status === "confirmed"));
                return (
                  <td key={event.id} className="px-3 py-4 align-top">
                    {outfit ? (
                      <div className="flex items-start gap-3">
                        {image ? (
                          shop ? <a href={shop} target="_blank" rel="noopener noreferrer" aria-label={`Open ${outfit.title} in shop`} className="shrink-0"><img src={imageUrl(image)} alt={outfit.title} loading="lazy" className="h-32 w-24 rounded object-cover" /></a>
                          : <img src={imageUrl(image)} alt={outfit.title} loading="lazy" className="h-32 w-24 shrink-0 rounded object-cover" />
                        ) : <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded bg-muted"><Minus className="size-4 text-muted-foreground" /></div>}
                        <div className="min-w-0 max-w-64 space-y-1.5">
                          {shop ? <a href={shop} target="_blank" rel="noopener noreferrer" className="block font-medium hover:text-primary hover:underline">{outfit.title}</a> : <p className="font-medium">{outfit.title}</p>}
                          {outfit.designer ? <p className="text-xs text-muted-foreground">{outfit.designer}</p> : null}
                          {outfit.notes ? <p className="text-xs text-muted-foreground whitespace-pre-line">{outfit.notes}</p> : null}
                          <p className="text-xs">Size: {choice?.size_choice ?? choice?.build_size ?? "Not selected"}</p>
                          <Badge variant="outline">{confirmed ? "Confirmed" : "Reserved"}</Badge>
                          {shop ? <Button asChild variant="link" size="sm" className="h-auto px-0 py-1"><a href={shop} target="_blank" rel="noopener noreferrer">View in shop <ExternalLink className="size-3" /></a></Button> : null}
                          <SubstitutionNote sub={choice ? subs.data?.get(choice.id) : undefined} />
                        </div>
                      </div>
                    ) : <p className="text-xs text-muted-foreground">Not chosen</p>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}