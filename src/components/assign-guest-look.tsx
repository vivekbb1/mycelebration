import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HostChooseOutfit } from "@/components/host-choose-outfit";

export function AssignGuestLook({ inviteId, onAssigned }: { inviteId: string; onAssigned: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [eventId, setEventId] = useState("");
  const [choosing, setChoosing] = useState(false);
  const data = useQuery({ queryKey: ["assign-guest-look", inviteId], enabled: open, queryFn: async () => {
    const [members, events, reservations] = await Promise.all([
      supabase.from("invite_codes").select("id,guest_name,gender,household").eq("invite_id", inviteId).order("guest_name"),
      supabase.from("events").select("id,name").eq("invite_id", inviteId).eq("outfit_selection", true).order("name"),
      supabase.from("reservations").select("member_code_id,outfits(event_id)").eq("invite_id", inviteId),
    ]);
    if (members.error) throw members.error; if (events.error) throw events.error; if (reservations.error) throw reservations.error;
    return { members: members.data, events: events.data, reservations: reservations.data };
  }});
  const member = data.data?.members.find(m => m.id === memberId);
  const event = data.data?.events.find(e => e.id === eventId);
  const missing = (id: string) => !data.data?.reservations.some(r => r.member_code_id === id && r.outfits?.event_id === eventId);
  return <>
    <Button size="sm" variant="outline" onClick={() => { setOpen(true); setMemberId(""); setEventId(""); }}>Assign look to guest</Button>
    <Dialog open={open && !choosing} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Assign look to guest</DialogTitle></DialogHeader>
      <label className="text-sm">Event<select aria-label="Assignment event" className="field-select w-full" value={eventId} onChange={e => { setEventId(e.target.value); setMemberId(""); }}><option value="">Choose event</option>{data.data?.events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label className="text-sm">Guest without a selection<select aria-label="Assignment guest" className="field-select w-full" disabled={!eventId} value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">Choose guest</option>{data.data?.members.filter(m => missing(m.id)).map(m => <option key={m.id} value={m.id}>{m.guest_name} · {m.household}</option>)}</select></label>
      {data.isError ? <p className="text-destructive">Could not load guests.</p> : null}
      <Button disabled={!member || !event} onClick={() => setChoosing(true)}>Choose outfit</Button>
    </DialogContent></Dialog>
    {choosing && member && event ? <HostChooseOutfit inviteId={inviteId} member={member} event={event} onAssigned={id => { onAssigned(id); setOpen(false); }} onClose={() => setChoosing(false)} /> : null}
  </>;
}