import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { guestSubstitutionComparison, substitutionRecipient, type SubstitutionSnapshot } from './outfit-substitution';
import { PUBLIC_ORIGIN } from './public-url';

const input = (value: unknown) => z.object({ historyId: z.string().uuid() }).parse(value);

export const previewSubstitutionEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(input)
  .handler(async ({ data, context }) => {
    const h = await context.supabase.from('wardrobe_substitution_history').select('*').eq('id', data.historyId).single();
    if (h.error) throw h.error;
    const host = await context.supabase.rpc('is_celebration_host', { _invite_id: h.data.invite_id });
    if (host.error || !host.data) throw new Error('Only celebration hosts can email outfit changes');
    const r = await context.supabase.from('reservations').select('member_code_id, guest_id, guest_name').eq('id', h.data.reservation_id).eq('invite_id', h.data.invite_id).single();
    if (r.error) throw r.error;
    const codes = await context.supabase.from('invite_codes').select('id, email, guest_name, household, claimed_by').eq('invite_id', h.data.invite_id);
    if (codes.error) throw codes.error;
    const to = substitutionRecipient(r.data, codes.data);
    return { to, historyId: h.data.id, ...guestSubstitutionComparison(h.data.original as SubstitutionSnapshot, h.data.replacement as SubstitutionSnapshot) };
  });

export const emailOutfitSubstitution = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(input)
  .handler(async ({ data, context }) => {
    // Resolve directly here: never call another RPC inside a server handler.
    const h = await context.supabase.from('wardrobe_substitution_history').select('*').eq('id', data.historyId).single();
    if (h.error) throw h.error;
    const host = await context.supabase.rpc('is_celebration_host', { _invite_id: h.data.invite_id });
    if (host.error || !host.data) throw new Error('Only celebration hosts can email outfit changes');
    const r = await context.supabase.from('reservations').select('member_code_id, guest_id, guest_name').eq('id', h.data.reservation_id).eq('invite_id', h.data.invite_id).single();
    if (r.error) throw r.error;
    const codes = await context.supabase.from('invite_codes').select('id, email, guest_name, household, claimed_by').eq('invite_id', h.data.invite_id);
    if (codes.error) throw codes.error;
    const to = substitutionRecipient(r.data, codes.data);
    if (!to) throw new Error('No unambiguous guest email is recorded. Add their email on the family page first.');
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    return sendTemplateEmail('outfit-substitution', to, { templateData: { ...guestSubstitutionComparison(h.data.original as SubstitutionSnapshot, h.data.replacement as SubstitutionSnapshot), portalUrl: PUBLIC_ORIGIN }, idempotencyKey: `outfit-substitution-${h.data.id}` });
  });