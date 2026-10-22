import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Mail, Repeat, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { OrderItem, OrderAlternative } from '@/lib/shop-order';
import type { SubstitutionSnapshot } from '@/lib/outfit-substitution';
import { previewSubstitutionEmail, emailOutfitSubstitution } from '@/lib/outfit-substitution.functions';
import { WARDROBES } from '@/lib/wardrobe-options';

export function OutfitSubstitution({ inviteId, item, orderId, onSaved, disabled = false }: { inviteId: string; item: OrderItem; orderId?: string; onSaved?: (item: OrderItem) => void; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [alternative, setAlternative] = useState<OrderAlternative>({ title: '', sku: '', designer: '', shop: '', image: '' });
  const [size, setSize] = useState(''); const [price, setPrice] = useState(0); const [expected, setExpected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [details, setDetails] = useState({ gender: 'women', color_family: '', garment_type: '', silhouette: '', notes: '' });
  const [emailPreview, setEmailPreview] = useState<Awaited<ReturnType<typeof previewSubstitutionEmail>> | null>(null);
  const preview = useServerFn(previewSubstitutionEmail); const sendEmail = useServerFn(emailOutfitSubstitution);
  const history = useQuery({ queryKey: ['outfit-substitution-history', item.reservationId], enabled: open, queryFn: async () => {
    const result = await supabase.from('wardrobe_substitution_history').select('*').eq('invite_id', inviteId).eq('reservation_id', item.reservationId).order('created_at', { ascending: false });
    if (result.error) throw result.error; return result.data;
  } });
  const wardrobe = useQuery({ queryKey: ['substitution-wardrobe', inviteId], enabled: open, queryFn: async () => {
    const result = await supabase.from('outfits').select('id,title,source_sku,designer,boutique_url,image_url,price_inr').eq('invite_id', inviteId).is('retired_at', null).order('title');
    if (result.error) throw result.error; return result.data;
  } });
  async function begin() {
    setBusy(true);
    try {
      let current = item;
      if (orderId) {
        const latest = await supabase.from('wardrobe_orders').select('items,updated_at').eq('id', orderId).eq('invite_id', inviteId).single();
        if (latest.error) throw latest.error;
        const found = (latest.data.items as unknown as OrderItem[]).find(i => i.reservationId === item.reservationId);
        if (!found) throw new Error('This look is no longer in the order');
        current = found; setExpected(latest.data.updated_at);
      } else {
        const latest = await supabase.from('wardrobe_preorder_alternatives').select('*').eq('reservation_id', item.reservationId).eq('invite_id', inviteId).maybeSingle();
        if (latest.error) throw latest.error;
        setExpected(latest.data?.updated_at ?? null);
        if (latest.data) current = { ...item, alternative: latest.data.alternative as OrderAlternative, orderedSize: latest.data.ordered_size, price: Number(latest.data.revised_price) };
      }
      setAlternative(current.alternative ?? { title: '', sku: '', designer: '', shop: '', image: '' });
      const reservation = await supabase.from('reservations').select('outfit_id').eq('id', item.reservationId).eq('invite_id', inviteId).single();
      if (reservation.error) throw reservation.error;
      const original = await supabase.from('outfits').select('gender,color_family,garment_type,silhouette').eq('id', reservation.data.outfit_id).single();
      if (original.error) throw original.error;
      setDetails({ gender: original.data.gender, color_family: original.data.color_family ?? '', garment_type: original.data.garment_type ?? '', silhouette: original.data.silhouette ?? '', notes: '' });
      setSize(current.orderedSize ?? ''); setPrice(current.price); setEmailPreview(null); setSearch(''); setOpen(true);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const result = await supabase.rpc('save_collection_substitution', { _reservation_id: item.reservationId, ...(orderId ? { _order_id: orderId } : {}), _alternative: alternative as unknown as Json, _size: size, _price: price, _details: details, ...(expected ? { _expected: expected } : {}) });
      if (result.error) throw result.error;
      const saved = result.data as { alternative: OrderAlternative };
      setAlternative(saved.alternative);
      onSaved?.({ ...item, alternative: saved.alternative, orderedSize: size.trim(), price });
      await Promise.all(['preorder-alternatives','wardrobe-orders','host-orders','reservations','outfit-substitution-history','outfits','substitution-wardrobe','host-choose-outfit','guest-offered-outfits','host-outfits'].map(k => qc.invalidateQueries({ queryKey: [k] })));
      // Reload the concurrency token before a second edit.
      const latest = orderId ? await supabase.from('wardrobe_orders').select('updated_at').eq('id', orderId).single() : await supabase.from('wardrobe_preorder_alternatives').select('updated_at').eq('reservation_id', item.reservationId).single();
      if (latest.data) setExpected(latest.data.updated_at);
      setEmailPreview(null); toast.success('Substitution saved; original retained and retired from future selections');
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => void begin()}><Repeat className="size-4" /> Substitute outfit</Button>
    <Dialog open={open} onOpenChange={v => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Substitute outfit · {item.wearer}</DialogTitle></DialogHeader>
      <div className="border-b border-border pb-3"><p className="text-sm font-medium">Original selection · {item.event}</p><p className="text-sm">{item.title} · {item.sku} · size {item.size || 'Not recorded'}</p></div>
      <Input type="search" aria-label="Search replacement wardrobe" placeholder="Search replacement outfit or model number" value={search} onChange={e => setSearch(e.target.value)} />
      <label className="text-sm">Replacement from wardrobe<select className="field-select w-full" aria-label="Replacement from wardrobe" value={alternative.outfitId ?? ''} onChange={e => {
        const o = wardrobe.data?.find(w => w.id === e.target.value);
        if (!o) { setAlternative(a => ({ ...a, outfitId: null })); return; }
        setAlternative({ outfitId: o.id, title: o.title, sku: o.source_sku ?? '', designer: o.designer ?? '', shop: o.boutique_url ?? '', image: o.image_url ?? '' });
        if (o.price_inr != null) setPrice(Number(o.price_inr));
      }}><option value="">Enter vendor proposal below</option>{(wardrobe.data ?? []).filter(w => w.id === alternative.outfitId || `${w.title} ${w.source_sku} ${w.designer}`.toLowerCase().includes(search.toLowerCase())).map(w => <option key={w.id} value={w.id}>{w.title}{w.source_sku ? ` · ${w.source_sku}` : ''}</option>)}</select></label>
      {alternative.image ? <img className="h-32 w-24 rounded-md object-cover" src={alternative.image} alt={alternative.title} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Replacement outfit<Input aria-label="Replacement outfit" value={alternative.title} onChange={e => setAlternative(a => ({ ...a, title: e.target.value }))} /></label>
        <label className="text-sm">Model number<Input value={alternative.sku} onChange={e => setAlternative(a => ({ ...a, sku: e.target.value }))} /></label>
        <label className="text-sm">Designer<Input value={alternative.designer} onChange={e => setAlternative(a => ({ ...a, designer: e.target.value }))} /></label>
        <label className="text-sm">Replacement size<Input aria-label="Replacement size" value={size} onChange={e => setSize(e.target.value)} /></label>
        <label className="text-sm">Revised price<Input aria-label="Replacement revised price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(Number(e.target.value))} /></label>
        <label className="text-sm">Shop link<Input value={alternative.shop} onChange={e => setAlternative(a => ({ ...a, shop: e.target.value }))} /></label>
        {!alternative.outfitId ? <>
          <label className="text-sm">Wardrobe<select className="field-select w-full" aria-label="Replacement wardrobe" value={details.gender} onChange={e => setDetails(d => ({ ...d, gender: e.target.value }))}>{WARDROBES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}</select></label>
          <label className="text-sm">Colour<Input value={details.color_family} onChange={e => setDetails(d => ({ ...d, color_family: e.target.value }))} /></label>
          <label className="text-sm">Garment type<Input value={details.garment_type} onChange={e => setDetails(d => ({ ...d, garment_type: e.target.value }))} /></label>
          <label className="text-sm">Silhouette<Input value={details.silhouette} onChange={e => setDetails(d => ({ ...d, silhouette: e.target.value }))} /></label>
          <label className="text-sm">Photo URL<Input type="url" value={alternative.image ?? ''} onChange={e => setAlternative(a => ({ ...a, image: e.target.value }))} /></label>
          <label className="text-sm">Notes<Input value={details.notes} onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))} /></label>
        </> : null}
      </div>
      <Button disabled={busy || !alternative.title.trim() || !size.trim()} onClick={() => void save()}>{alternative.outfitId ? 'Save substitution' : 'Add to collection & save substitution'}</Button>
      <h3 className="flex items-center gap-2 text-sm font-medium"><History className="size-4" /> Substitution history</h3>
      {history.isError ? <p className="text-sm text-destructive">Couldn't load history.</p> : null}
      {history.data?.map(h => { const original = h.original as SubstitutionSnapshot; const previous = h.previous as SubstitutionSnapshot; const replacement = h.replacement as SubstitutionSnapshot;
        return <div key={h.id} className="space-y-1 border-t border-border pt-3 text-sm">
          <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('en-GB')} · {h.order_id ? 'Order' : 'Pre-order'}</p>
          <p>Original: {original.title} · size {original.size || 'Not recorded'}</p><p>Previous: {previous.title} · size {previous.size || 'Not recorded'}</p><p>Replacement: {replacement.title} · size {replacement.size || 'Not recorded'}</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { setEmailPreview(await preview({ data: { historyId: h.id } })); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}><Mail className="size-4" /> Preview guest email</Button>
        </div>;
      })}
      {history.isSuccess && !history.data.length ? <p className="text-sm text-muted-foreground">No substitutions recorded yet.</p> : null}
      {emailPreview ? <div className="space-y-2 border-t border-border pt-3 text-sm"><h3 className="font-medium">Guest email · {emailPreview.wearer} · {emailPreview.event}</h3><p>To: {emailPreview.to || 'No guest email recorded — add it on the family page'}</p><p>Original: {emailPreview.originalTitle} · {emailPreview.originalSku} · size {emailPreview.originalSize}</p><p>Replacement: {emailPreview.replacementTitle} · {emailPreview.replacementSku} · size {emailPreview.replacementSize}</p><Button disabled={busy || !emailPreview.to} onClick={async () => { setBusy(true); try { const result = await sendEmail({ data: { historyId: emailPreview.historyId } }); if (result.sent) toast.success('Guest email sent'); else toast.error('Email not sent: this recipient has opted out or is blocked'); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}><Mail className="size-4" /> Email guest</Button></div> : null}
    </DialogContent></Dialog>
  </>;
}
function errorMessage(e: unknown) { return e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Could not save substitution'; }