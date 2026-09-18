CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value text NOT NULL,
  default_value text NOT NULL,
  label text NOT NULL,
  group_name text NOT NULL,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','multiline')),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read site content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admins manage site content"
  ON public.site_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_content (key, label, group_name, kind, sort_order, default_value, value)
VALUES
  ('landing.brand', 'Site name in the header', 'Welcome page', 'text', 1, $t$The Wedding Wardrobe$t$, $t$The Wedding Wardrobe$t$),
  ('landing.signin', 'Sign-in button', 'Welcome page', 'text', 2, $t$Guest sign in$t$, $t$Guest sign in$t$),
  ('landing.eyebrow', 'Small line above the headline', 'Welcome page', 'text', 3, $t$A gift from the family$t$, $t$A gift from the family$t$),
  ('landing.headline', 'Headline', 'Welcome page', 'multiline', 4, $t$Festive Indian attire, chosen for you before you land.$t$, $t$Festive Indian attire, chosen for you before you land.$t$),
  ('landing.body', 'Opening paragraph', 'Welcome page', 'multiline', 5, $t$We know a lehenga fitting isn't easy to arrange from abroad. So we've curated a wardrobe for every function of the wedding. Reserve the look you love, send your measurements, and it will be waiting for you — tailored, pressed and paid for.$t$, $t$We know a lehenga fitting isn't easy to arrange from abroad. So we've curated a wardrobe for every function of the wedding. Reserve the look you love, send your measurements, and it will be waiting for you — tailored, pressed and paid for.$t$),
  ('landing.cta_primary', 'Main button', 'Welcome page', 'text', 6, $t$Open your invitation$t$, $t$Open your invitation$t$),
  ('landing.cta_secondary', 'Second button', 'Welcome page', 'text', 7, $t$I already registered$t$, $t$I already registered$t$),
  ('landing.code_note', 'Note under the buttons', 'Welcome page', 'multiline', 8, $t$You'll need the invitation code we sent you on WhatsApp or email.$t$, $t$You'll need the invitation code we sent you on WhatsApp or email.$t$),
  ('landing.how_title', 'How it works — title', 'Welcome page', 'text', 9, $t$How it works$t$, $t$How it works$t$),
  ('landing.step1_title', 'Step 1 title', 'Welcome page', 'text', 10, $t$Browse the lookbook$t$, $t$Browse the lookbook$t$),
  ('landing.step1_body', 'Step 1 text', 'Welcome page', 'multiline', 11, $t$Curated lehengas, sarees, sherwanis and indo-western looks, grouped by function and hand-picked from designer boutiques.$t$, $t$Curated lehengas, sarees, sherwanis and indo-western looks, grouped by function and hand-picked from designer boutiques.$t$),
  ('landing.step2_title', 'Step 2 title', 'Welcome page', 'text', 12, $t$Claim your look$t$, $t$Claim your look$t$),
  ('landing.step2_body', 'Step 2 text', 'Welcome page', 'multiline', 13, $t$Each outfit can be claimed by one guest only. Once it's yours, it disappears from everyone else's list — no accidental twinning.$t$, $t$Each outfit can be claimed by one guest only. Once it's yours, it disappears from everyone else's list — no accidental twinning.$t$),
  ('landing.step3_title', 'Step 3 title', 'Welcome page', 'text', 14, $t$Send measurements$t$, $t$Send measurements$t$),
  ('landing.step3_body', 'Step 3 text', 'Welcome page', 'multiline', 15, $t$A guided form walks you through every measurement a tailor needs, in centimetres or inches, with tips for each one.$t$, $t$A guided form walks you through every measurement a tailor needs, in centimetres or inches, with tips for each one.$t$),
  ('landing.step4_title', 'Step 4 title', 'Welcome page', 'text', 16, $t$We handle the rest$t$, $t$We handle the rest$t$),
  ('landing.step4_body', 'Step 4 text', 'Welcome page', 'multiline', 17, $t$Ordering, tailoring and delivery are on us. The outfit is our gift — you just have to show up and dance.$t$, $t$Ordering, tailoring and delivery are on us. The outfit is our gift — you just have to show up and dance.$t$),
  ('landing.unique_eyebrow', 'Closing section — small line', 'Welcome page', 'text', 18, $t$One guest, one look$t$, $t$One guest, one look$t$),
  ('landing.unique_title', 'Closing section — title', 'Welcome page', 'text', 19, $t$No two guests in the same outfit.$t$, $t$No two guests in the same outfit.$t$),
  ('landing.unique_body', 'Closing section — text', 'Welcome page', 'multiline', 20, $t$Every piece in the lookbook is reserved the moment a guest claims it, so the wardrobe you see is always the wardrobe that's still available. Reserve early for the best choice.$t$, $t$Every piece in the lookbook is reserved the moment a guest claims it, so the wardrobe you see is always the wardrobe that's still available. Reserve early for the best choice.$t$),
  ('landing.unique_cta', 'Closing button', 'Welcome page', 'text', 21, $t$Choose your outfits$t$, $t$Choose your outfits$t$),
  ('landing.footer', 'Footer line', 'Welcome page', 'multiline', 22, $t$A private portal for our wedding guests. Questions? Message the family group.$t$, $t$A private portal for our wedding guests. Questions? Message the family group.$t$),
  ('nav.brand', 'Couple names in the top bar', 'Menu', 'text', 1, $t$Kush & Khyati$t$, $t$Kush & Khyati$t$),
  ('nav.invitation', 'Invitation menu link', 'Menu', 'text', 2, $t$Your invitation$t$, $t$Your invitation$t$),
  ('invitation.eyebrow', 'Small line above the names', 'Invitation page', 'text', 1, $t$Together with our families$t$, $t$Together with our families$t$),
  ('invitation.couple', 'Couple names', 'Invitation page', 'text', 2, $t$Kush & Khyati$t$, $t$Kush & Khyati$t$),
  ('invitation.greeting', 'Greeting (the guest name is added before it)', 'Invitation page', 'multiline', 3, $t$we would be honoured to have you with us.$t$, $t$we would be honoured to have you with us.$t$),
  ('invitation.steps_eyebrow', 'Steps — small line', 'Invitation page', 'text', 4, $t$Three simple steps$t$, $t$Three simple steps$t$),
  ('invitation.steps_title_open', 'Steps title — still to do', 'Invitation page', 'text', 5, $t$Here's what's left to do$t$, $t$Here's what's left to do$t$),
  ('invitation.steps_title_done', 'Steps title — all finished', 'Invitation page', 'text', 6, $t$You're all set$t$, $t$You're all set$t$),
  ('invitation.all_done_note', 'Note when every step is done', 'Invitation page', 'multiline', 7, $t$Everything's done — we'll be in touch about delivery. You can still change any answer.$t$, $t$Everything's done — we'll be in touch about delivery. You can still change any answer.$t$),
  ('invitation.functions_title', 'Heading above the function cards', 'Invitation page', 'text', 8, $t$Your functions$t$, $t$Your functions$t$),
  ('invitation.delivery_cta', 'Delivery button', 'Invitation page', 'text', 9, $t$How your outfit reaches you$t$, $t$How your outfit reaches you$t$),
  ('step.rsvp_title', 'Step 1 title', 'Guest steps', 'text', 1, $t$Tell us if you're coming$t$, $t$Tell us if you're coming$t$),
  ('step.rsvp_body', 'Step 1 text', 'Guest steps', 'multiline', 2, $t$A yes or no, plus anything we should know — arrival day, food, who's travelling with you.$t$, $t$A yes or no, plus anything we should know — arrival day, food, who's travelling with you.$t$),
  ('step.rsvp_cta', 'Step 1 button', 'Guest steps', 'text', 3, $t$Reply now$t$, $t$Reply now$t$),
  ('step.rsvp_cta_done', 'Step 1 button once replied', 'Guest steps', 'text', 4, $t$Change your answer$t$, $t$Change your answer$t$),
  ('step.outfit_title', 'Step 2 title', 'Guest steps', 'text', 5, $t$Choose your outfit$t$, $t$Choose your outfit$t$),
  ('step.outfit_body', 'Step 2 text', 'Guest steps', 'multiline', 6, $t$Pick a look for each function where the outfit is our gift to you.$t$, $t$Pick a look for each function where the outfit is our gift to you.$t$),
  ('step.outfit_body_own', 'Step 2 text when they wear their own outfit', 'Guest steps', 'multiline', 7, $t$For your functions you'll wear your own outfit — nothing to choose here.$t$, $t$For your functions you'll wear your own outfit — nothing to choose here.$t$),
  ('step.outfit_cta', 'Step 2 button', 'Guest steps', 'text', 8, $t$Choose a look$t$, $t$Choose a look$t$),
  ('step.outfit_cta_done', 'Step 2 button once chosen', 'Guest steps', 'text', 9, $t$See or change your looks$t$, $t$See or change your looks$t$),
  ('step.measure_title', 'Step 3 title', 'Guest steps', 'text', 10, $t$Send your measurements$t$, $t$Send your measurements$t$),
  ('step.measure_body', 'Step 3 text', 'Guest steps', 'multiline', 11, $t$So your outfit is tailored before you arrive. Every field has a tip to help you measure.$t$, $t$So your outfit is tailored before you arrive. Every field has a tip to help you measure.$t$),
  ('step.measure_cta', 'Step 3 button', 'Guest steps', 'text', 12, $t$Send measurements$t$, $t$Send measurements$t$),
  ('step.measure_cta_done', 'Step 3 button once sent', 'Guest steps', 'text', 13, $t$Update measurements$t$, $t$Update measurements$t$),
  ('card.gift_badge', 'Badge when the outfit is your gift', 'Function cards', 'text', 1, $t$Outfit is our gift to you$t$, $t$Outfit is our gift to you$t$),
  ('card.own_badge', 'Badge when they wear their own outfit', 'Function cards', 'text', 2, $t$Please wear your own outfit for this function$t$, $t$Please wear your own outfit for this function$t$),
  ('card.look_prefix', 'Label before the look they chose', 'Function cards', 'text', 3, $t$Your look:$t$, $t$Your look:$t$),
  ('card.choose_prefix', 'Choose button (the function name is added after)', 'Function cards', 'text', 4, $t$Choose your look for$t$, $t$Choose your look for$t$),
  ('card.change_cta', 'Change button', 'Function cards', 'text', 5, $t$Change your look$t$, $t$Change your look$t$),
  ('rsvp.title', 'RSVP panel title', 'RSVP page', 'text', 1, $t$Your RSVP$t$, $t$Your RSVP$t$),
  ('rsvp.note_label', 'Message box label', 'RSVP page', 'text', 2, $t$Anything we should know? (optional)$t$, $t$Anything we should know? (optional)$t$),
  ('rsvp.note_placeholder', 'Message box placeholder', 'RSVP page', 'text', 3, $t$Arrival date, dietary needs, travelling with family…$t$, $t$Arrival date, dietary needs, travelling with family…$t$),
  ('rsvp.yes_cta', 'Yes button', 'RSVP page', 'text', 4, $t$I'll be there$t$, $t$I'll be there$t$),
  ('rsvp.yes_update', 'Yes button once replied', 'RSVP page', 'text', 5, $t$Update — I'll be there$t$, $t$Update — I'll be there$t$),
  ('rsvp.no_cta', 'No button', 'RSVP page', 'text', 6, $t$Sadly can't make it$t$, $t$Sadly can't make it$t$),
  ('rsvp.dress_note', 'Dress code note', 'RSVP page', 'multiline', 7, $t$Dress codes are guidance, not rules — but red and ivory are reserved for the couple.$t$, $t$Dress codes are guidance, not rules — but red and ivory are reserved for the couple.$t$),
  ('rsvp.thanks_yes', 'Message after saying yes', 'RSVP page', 'text', 8, $t$Wonderful — you're on the list.$t$, $t$Wonderful — you're on the list.$t$),
  ('rsvp.thanks_no', 'Message after saying no', 'RSVP page', 'text', 9, $t$Thank you for letting us know.$t$, $t$Thank you for letting us know.$t$);
