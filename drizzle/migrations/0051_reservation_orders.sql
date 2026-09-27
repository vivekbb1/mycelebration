ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS order_placed_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS order_amount numeric,
  ADD COLUMN IF NOT EXISTS order_currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'not shipped',
  ADD COLUMN IF NOT EXISTS order_note text;