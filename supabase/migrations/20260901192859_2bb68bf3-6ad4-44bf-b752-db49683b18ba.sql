-- 1. Event details
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS rsvp_by date;

-- 2. RSVP on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rsvp_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rsvp_note text,
  ADD COLUMN IF NOT EXISTS rsvp_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_rsvp_status_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_rsvp_status_check
      CHECK (rsvp_status IN ('pending', 'yes', 'no'));
  END IF;
END $$;

-- 3. Fill in the four functions
UPDATE public.events SET
  event_date = '2027-02-11',
  start_time = '4:00 pm onwards',
  venue = 'The Courtyard, Devi Ratn',
  venue_address = 'Jaipur–Kukas Road, Jaipur, Rajasthan 302028, India',
  dress_code = 'Bright summer colours and florals. Please avoid red and ivory.',
  note = 'Mehndi artists from 4pm, dinner under the fairy lights. Comfortable, breathable fabrics recommended.',
  rsvp_by = '2026-12-15'
WHERE name ILIKE 'mehndi';

UPDATE public.events SET
  event_date = '2027-02-12',
  start_time = '7:30 pm onwards',
  venue = 'Sheesh Mahal Lawns, Devi Ratn',
  venue_address = 'Jaipur–Kukas Road, Jaipur, Rajasthan 302028, India',
  dress_code = 'Glamorous. Sequins, metallics and jewel tones very welcome.',
  note = 'Family performances start at 9pm — wear something you can dance in.',
  rsvp_by = '2026-12-15'
WHERE name ILIKE 'sangeet';

UPDATE public.events SET
  event_date = '2027-02-13',
  start_time = '10:00 am, baraat at 9:15 am',
  venue = 'Amer Baradari Garden',
  venue_address = 'Amer Fort Road, Amer, Jaipur, Rajasthan 302028, India',
  dress_code = 'Traditional and formal. Red and ivory are reserved for the couple.',
  note = 'An outdoor daytime ceremony — hats, shawls and flat shoes are a good idea.',
  rsvp_by = '2026-12-15'
WHERE name ILIKE 'ceremony' OR name ILIKE 'wedding%';

UPDATE public.events SET
  event_date = '2027-02-13',
  start_time = '8:00 pm onwards',
  venue = 'The Grand Ballroom, Rambagh Palace',
  venue_address = 'Bhawani Singh Road, Jaipur, Rajasthan 302005, India',
  dress_code = 'Black tie meets Indian formal — floor-length gowns, sarees, bandhgalas.',
  note = 'Cocktails from 8pm, dinner at 9:30pm. Shuttles leave the hotel lobby at 7:30pm.',
  rsvp_by = '2026-12-15'
WHERE name ILIKE 'reception';

-- 4. Sample wardrobe
WITH ev AS (SELECT id, lower(name) AS n FROM public.events)
INSERT INTO public.outfits
  (event_id, title, designer, boutique_url, image_url, color_family, gender, garment_type, size_note, price_note, notes)
VALUES
  ((SELECT id FROM ev WHERE n LIKE 'mehndi'), 'Marigold mirror-work lehenga', 'Arpita Mehta', 'https://www.perniaspopupshop.com/designers/arpita-mehta', '/outfits/mehndi-marigold-lehenga.jpg', 'Marigold', 'women', 'Lehenga', 'Made to measure', 'approx. ₹95,000', 'Mirror-work blouse with a light georgette skirt — easy to sit in for the mehndi.'),
  ((SELECT id FROM ev WHERE n LIKE 'mehndi'), 'Blush block-print anarkali', 'Punit Balana', 'https://www.perniaspopupshop.com/designers/punit-balana', '/outfits/mehndi-blush-anarkali.jpg', 'Blush pink', 'women', 'Anarkali', 'Made to measure', 'approx. ₹48,000', 'Hand block-printed cotton silk with a matching organza dupatta.'),
  ((SELECT id FROM ev WHERE n LIKE 'mehndi'), 'Ivory chikankari kurta set', 'Anita Dongre', 'https://www.perniaspopupshop.com/designers/anita-dongre', '/outfits/mehndi-ivory-kurta-men.jpg', 'Ivory', 'men', 'Kurta set', 'Sizes 38–44', 'approx. ₹32,000', 'Light chikankari kurta with churidar — the coolest option for a daytime function.'),
  ((SELECT id FROM ev WHERE n LIKE 'sangeet'), 'Emerald sequin saree gown', 'Seema Gujral', 'https://www.perniaspopupshop.com/designers/seema-gujral', '/outfits/sangeet-emerald-saree-gown.jpg', 'Emerald', 'women', 'Saree gown', 'Made to measure', 'approx. ₹1,20,000', 'Pre-draped, so no pinning — designed for dancing.'),
  ((SELECT id FROM ev WHERE n LIKE 'sangeet'), 'Midnight blue cape lehenga', 'Ridhi Mehra', 'https://www.perniaspopupshop.com/designers/ridhi-mehra', '/outfits/sangeet-midnight-cape-lehenga.jpg', 'Midnight blue', 'women', 'Lehenga', 'Made to measure', 'approx. ₹1,10,000', 'Sequinned cape over a bustier and flared skirt. Indo-western and very photogenic.'),
  ((SELECT id FROM ev WHERE n LIKE 'sangeet'), 'Charcoal embroidered bandhgala', 'Shantnu & Nikhil', 'https://www.perniaspopupshop.com/designers/shantnu-nikhil', '/outfits/sangeet-charcoal-bandhgala.jpg', 'Charcoal', 'men', 'Bandhgala', 'Sizes 38–46', 'approx. ₹85,000', 'Structured bandhgala jacket with tapered trousers.'),
  ((SELECT id FROM ev WHERE n LIKE 'ceremony' OR n LIKE 'wedding%'), 'Saffron handloom silk saree', 'Raw Mango', 'https://www.perniaspopupshop.com/designers/raw-mango', '/outfits/ceremony-saffron-silk-saree.jpg', 'Saffron', 'women', 'Saree', 'Blouse made to measure', 'approx. ₹72,000', 'Mulberry silk with a zari border. We''ll stitch the blouse to your measurements.'),
  ((SELECT id FROM ev WHERE n LIKE 'ceremony' OR n LIKE 'wedding%'), 'Pistachio organza lehenga', 'Jayanti Reddy', 'https://www.perniaspopupshop.com/designers/jayanti-reddy', '/outfits/ceremony-pistachio-lehenga.jpg', 'Pistachio', 'women', 'Lehenga', 'Made to measure', 'approx. ₹1,35,000', 'Soft pastel with gota patti detail — perfect for a daytime garden ceremony.'),
  ((SELECT id FROM ev WHERE n LIKE 'ceremony' OR n LIKE 'wedding%'), 'Ivory raw silk sherwani', 'Tarun Tahiliani', 'https://www.perniaspopupshop.com/designers/tarun-tahiliani', '/outfits/ceremony-ivory-sherwani.jpg', 'Ivory', 'men', 'Sherwani', 'Sizes 38–46', 'approx. ₹1,45,000', 'Tonal thread-work sherwani with a silk stole. Ivory is fine for the groom''s side.'),
  ((SELECT id FROM ev WHERE n LIKE 'reception'), 'Wine velvet floor-length gown', 'Torani', 'https://www.perniaspopupshop.com/designers/torani', '/outfits/reception-wine-velvet-gown.jpg', 'Wine', 'women', 'Gown', 'Made to measure', 'approx. ₹98,000', 'Velvet with a subtle train — warm enough for a February evening.'),
  ((SELECT id FROM ev WHERE n LIKE 'reception'), 'Champagne tissue saree', 'Anju Modi', 'https://www.perniaspopupshop.com/designers/anju-modi', '/outfits/reception-champagne-saree.jpg', 'Champagne', 'women', 'Saree', 'Blouse made to measure', 'approx. ₹88,000', 'Tissue silk with a hand-embroidered blouse. Understated and black-tie appropriate.'),
  ((SELECT id FROM ev WHERE n LIKE 'reception'), 'Black tuxedo bandhgala', 'Manish Malhotra', 'https://www.perniaspopupshop.com/designers/manish-malhotra', '/outfits/reception-black-tuxedo-bandhgala.jpg', 'Black', 'men', 'Bandhgala', 'Sizes 38–46', 'approx. ₹1,25,000', 'Tuxedo-cut bandhgala with satin lapels — black tie with an Indian collar.');

-- 5. Sample guests, invitations, reservations and measurements
INSERT INTO public.profiles (id, full_name, email, city, country, whatsapp, invite_claimed, rsvp_status, rsvp_note, rsvp_updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Emma Whitfield', 'emma.whitfield@example.com', 'London', 'United Kingdom', '+44 7700 900123', true, 'yes', 'Arriving 9 Feb, staying at the hotel.', now() - interval '9 days'),
  ('22222222-2222-4222-8222-222222222222', 'Lucas Meyer', 'lucas.meyer@example.com', 'Berlin', 'Germany', '+49 1512 3456789', true, 'yes', NULL, now() - interval '7 days'),
  ('33333333-3333-4333-8333-333333333333', 'Sofia Marchetti', 'sofia.marchetti@example.com', 'Milan', 'Italy', '+39 333 1234567', true, 'yes', 'Vegetarian, no nuts please.', now() - interval '4 days'),
  ('44444444-4444-4444-8444-444444444444', 'Daniel Osei', 'daniel.osei@example.com', 'Toronto', 'Canada', '+1 416 555 0142', true, 'pending', NULL, NULL),
  ('55555555-5555-4555-8555-555555555555', 'Aiko Tanaka', 'aiko.tanaka@example.com', 'Tokyo', 'Japan', '+81 90 1234 5678', true, 'no', 'So sorry — clashes with a work trip.', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invite_codes (code, guest_name, email, claimed_by, claimed_at)
VALUES
  ('EMMA-2041', 'Emma Whitfield', 'emma.whitfield@example.com', '11111111-1111-4111-8111-111111111111', now() - interval '10 days'),
  ('LUCAS-3382', 'Lucas Meyer', 'lucas.meyer@example.com', '22222222-2222-4222-8222-222222222222', now() - interval '8 days'),
  ('SOFIA-5517', 'Sofia Marchetti', 'sofia.marchetti@example.com', '33333333-3333-4333-8333-333333333333', now() - interval '5 days'),
  ('DANIEL-6620', 'Daniel Osei', 'daniel.osei@example.com', '44444444-4444-4444-8444-444444444444', now() - interval '3 days'),
  ('AIKO-7734', 'Aiko Tanaka', 'aiko.tanaka@example.com', '55555555-5555-4555-8555-555555555555', now() - interval '3 days'),
  ('PRIYA-8123', 'Priya Raghunathan', 'priya.r@example.com', NULL, NULL),
  ('OLIVER-9045', 'Oliver Brandt', 'oliver.brandt@example.com', NULL, NULL),
  ('NADIA-1188', 'Nadia Haddad', 'nadia.haddad@example.com', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.reservations (outfit_id, guest_id, guest_name, created_at)
SELECT o.id, v.guest_id::uuid, v.guest_name, now() - interval '4 days'
FROM (VALUES
  ('Marigold mirror-work lehenga', '11111111-1111-4111-8111-111111111111', 'Emma Whitfield'),
  ('Charcoal embroidered bandhgala', '22222222-2222-4222-8222-222222222222', 'Lucas Meyer'),
  ('Pistachio organza lehenga', '33333333-3333-4333-8333-333333333333', 'Sofia Marchetti')
) AS v(title, guest_id, guest_name)
JOIN public.outfits o ON o.title = v.title
ON CONFLICT DO NOTHING;

INSERT INTO public.measurements (guest_id, unit, height, bust, waist, hip, shoulder, sleeve_length, top_length, bottom_length, inseam, notes)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'cm', 168, 89, 71, 97, 38, 46, 38, 104, 76, 'Would prefer three-quarter sleeves on the blouse.'),
  ('33333333-3333-4333-8333-333333333333', 'in', 65, 34, 27, 37, 15, 18, 15, 40, 29, 'Wearing 3 inch heels.')
ON CONFLICT DO NOTHING;