ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS page_name TEXT NOT NULL DEFAULT 'Site-wide';

UPDATE public.site_content SET page_name = CASE group_name
  WHEN 'Welcome page' THEN 'Welcome page'
  WHEN 'Invitation page' THEN 'Invitation'
  WHEN 'Guest steps' THEN 'Invitation'
  WHEN 'Function cards' THEN 'Invitation'
  WHEN 'RSVP page' THEN 'RSVP'
  WHEN 'Menu' THEN 'Site-wide'
  ELSE 'Site-wide' END;

INSERT INTO public.site_content (key, value, default_value, label, group_name, page_name, kind, sort_order) VALUES
  ('nav.tab_invite', 'Invite', 'Invite', 'Tab: invitation', 'Menu', 'Site-wide', 'text', 3),
  ('nav.tab_rsvp', 'RSVP', 'RSVP', 'Tab: RSVP', 'Menu', 'Site-wide', 'text', 4),
  ('nav.tab_outfit', 'Outfit', 'Outfit', 'Tab: outfit', 'Menu', 'Site-wide', 'text', 5),
  ('nav.tab_measurement', 'Measurement', 'Measurement', 'Tab: measurements', 'Menu', 'Site-wide', 'text', 6)
ON CONFLICT (key) DO NOTHING;