ALTER TABLE public.wardrobe_orders
  ADD COLUMN IF NOT EXISTS seller_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS salesperson_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS salesperson_mobile text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seller_total numeric CHECK (seller_total IS NULL OR seller_total >= 0),
  ADD COLUMN IF NOT EXISTS advance_amount numeric NOT NULL DEFAULT 0 CHECK (advance_amount >= 0),
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE POLICY "Hosts read order documents" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='order-documents' AND public.is_celebration_host((storage.foldername(name))[1]::uuid));
CREATE POLICY "Hosts upload order documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='order-documents' AND public.is_celebration_host((storage.foldername(name))[1]::uuid));
CREATE POLICY "Hosts delete order documents" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='order-documents' AND public.is_celebration_host((storage.foldername(name))[1]::uuid));