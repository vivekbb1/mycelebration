CREATE TABLE public.logistics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  intro text NOT NULL DEFAULT '',
  hotel_name text,
  hotel_address text,
  checkin_note text,
  measurements_deadline text,
  team_name text,
  team_whatsapp text,
  team_email text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT logistics_singleton_check CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE ON public.logistics TO authenticated;
GRANT ALL ON public.logistics TO service_role;

ALTER TABLE public.logistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests read logistics" ON public.logistics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage logistics" ON public.logistics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER logistics_updated_at BEFORE UPDATE ON public.logistics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.logistics (
  singleton, intro, checkin_note, measurements_deadline, timeline
) VALUES (
  true,
  'You never have to speak to a tailor or pay for anything. Reserve a look, send your measurements once, and your outfit will be waiting in your hotel room when you check in.',
  'Your outfits are pressed, labelled with your name and each function, and placed in your room before you arrive. The events team handles all logistics — no pickup desk, no paperwork.',
  'Please send your measurements as early as you can so there is time for tailoring.',
  '[]'::jsonb
);