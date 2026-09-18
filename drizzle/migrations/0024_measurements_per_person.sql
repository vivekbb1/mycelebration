ALTER TABLE public.measurements ADD COLUMN IF NOT EXISTS guest_name text NOT NULL DEFAULT '';

ALTER TABLE public.measurements DROP CONSTRAINT IF EXISTS measurements_guest_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS measurements_one_row_per_person
  ON public.measurements (guest_id, guest_name);