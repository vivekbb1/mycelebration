import { it } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

it('pre-order and order substitutions retain original choice and append immutable size history without invoices', async () => {
  const session = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, 'utf8')).session;
  const url = process.env['VITE_SUPABASE_URL'], key = process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Test backend not configured');
  const c = createClient<Database>(url, key, { accessToken: async () => session.access_token, auth: { persistSession: false } });
  const host = await c.from('celebration_hosts').select('invite_id').eq('user_id', session.user.id).limit(1).single();
  if (host.error) throw host.error;
  const invite = host.data.invite_id;
  const outfit = await c.from('outfits').insert({ invite_id: invite, title: 'Substitution test original', gender: 'men', price_inr: 30000 }).select('id').single();
  if (outfit.error) throw outfit.error;
  let reservationId: string | undefined, orderId: string | undefined, replacementId: string | undefined;
  try {
    const r = await c.from('reservations').insert({ invite_id: invite, outfit_id: outfit.data.id, guest_id: session.user.id, guest_name: 'Substitution verification', size_choice: 'M' }).select('id').single();
    if (r.error) throw r.error; reservationId = r.data.id;
    let alternative = { title: 'Vendor proposal', sku: 'ALT1', designer: '', shop: '', image: '' };
    const saved = await c.rpc('save_collection_substitution', { _reservation_id: reservationId, _alternative: alternative, _size: 'L', _price: 35000, _details: { gender: 'men', color_family: 'Green', garment_type: 'Sherwani' } });
    if (saved.error) throw saved.error;
    const collectionResult = saved.data as { alternative: typeof alternative; replacementOutfitId: string };
    alternative = collectionResult.alternative; replacementId = collectionResult.replacementOutfitId;
    const collection = await c.from('outfits').select('title,price_inr,color_family,garment_type,gender,size_note,invite_id,retired_at').eq('id', replacementId).single();
    if (collection.error) throw collection.error;
    strictEqual(collection.data.title, 'Vendor proposal'); strictEqual(collection.data.price_inr, 35000); strictEqual(collection.data.color_family, 'Green'); strictEqual(collection.data.garment_type, 'Sherwani'); strictEqual(collection.data.gender, 'men'); strictEqual(collection.data.size_note, 'L'); strictEqual(collection.data.invite_id, invite); strictEqual(collection.data.retired_at, null);
    const retired = await c.from('outfits').select('retired_at').eq('id', outfit.data.id).single();
    if (retired.error) throw retired.error;
    ok(retired.data.retired_at, 'original must be retired from future selections');
    const blocked = await c.from('reservations').insert({ invite_id: invite, outfit_id: outfit.data.id, guest_id: session.user.id, guest_name: 'Another wearer', size_choice: 'S' });
    ok(blocked.error?.message.includes('retired'), 'retirement must block new selections at the database boundary');
    const pre = await c.from('wardrobe_preorder_alternatives').select('*').eq('reservation_id', reservationId).single();
    if (pre.error) throw pre.error;
    strictEqual(pre.data.ordered_size, 'L'); strictEqual(pre.data.revised_price, 35000);
    const original = await c.from('reservations').select('outfit_id,size_choice,status').eq('id', reservationId).single();
    if (original.error) throw original.error;
    strictEqual(original.data.outfit_id, outfit.data.id); strictEqual(original.data.size_choice, 'M'); strictEqual(original.data.status, 'reserved');
    const duplicate = await c.rpc('save_outfit_substitution', { _reservation_id: reservationId, _alternative: alternative, _size: 'XL', _price: 35000 });
    ok(duplicate.error, 'stale pre-order updates must be rejected');
    const history = await c.from('wardrobe_substitution_history').select('*').eq('reservation_id', reservationId);
    if (history.error) throw history.error;
    strictEqual(history.data.length, 1);
    strictEqual((history.data[0]?.original as { size: string }).size, 'M'); strictEqual((history.data[0]?.replacement as { size: string }).size, 'L');
    await c.from('wardrobe_substitution_history').update({ replacement: {} }).eq('reservation_id', reservationId);
    const immutable = await c.from('wardrobe_substitution_history').select('replacement').eq('reservation_id', reservationId).single();
    if (immutable.error) throw immutable.error;
    strictEqual((immutable.data.replacement as { size: string }).size, 'L', 'hosts cannot rewrite audit history');
    const ordered = await c.from('wardrobe_orders').insert({ invite_id: invite, reference: `substitution-test-${crypto.randomUUID()}`, status: 'placed', items: [{ reservationId, title: 'Substitution test original', sku: '', size: 'M', orderedSize: 'L', alternative, price: 35000, discount: 0, measurements: { height: 170 } }] }).select('id,updated_at').single();
    if (ordered.error) throw ordered.error; orderId = ordered.data.id;
    const changed = await c.rpc('save_outfit_substitution', { _reservation_id: reservationId, _order_id: orderId, _alternative: { ...alternative, title: 'Second vendor proposal' }, _size: 'XL', _price: 36000, _expected: ordered.data.updated_at });
    if (changed.error) throw changed.error;
    const final = await c.from('reservations').select('outfit_id,size_choice,ordered_size,status').eq('id', reservationId).single();
    if (final.error) throw final.error;
    strictEqual(final.data.outfit_id, outfit.data.id); strictEqual(final.data.size_choice, 'M'); strictEqual(final.data.ordered_size, 'XL'); strictEqual(final.data.status, 'confirmed');
    const finalHistory = await c.from('wardrobe_substitution_history').select('*').eq('reservation_id', reservationId).order('created_at');
    if (finalHistory.error) throw finalHistory.error;
    strictEqual(finalHistory.data.length, 2); strictEqual((finalHistory.data[1]?.original as { size: string }).size, 'M');
    strictEqual((finalHistory.data[1]?.replacement as { size: string }).size, 'XL');
  } finally {
    if (orderId) { const d = await c.from('wardrobe_orders').delete().eq('id', orderId); if (d.error) throw d.error; }
    if (reservationId) { const d = await c.from('reservations').delete().eq('id', reservationId); if (d.error) throw d.error; }
    if (replacementId) { const d = await c.from('outfits').delete().eq('id', replacementId); if (d.error) throw d.error; }
    const d = await c.from('outfits').delete().eq('id', outfit.data.id); if (d.error) throw d.error;
  }
});