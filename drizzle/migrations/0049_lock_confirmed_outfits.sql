DROP POLICY IF EXISTS "guests delete own reservation" ON public.reservations;
CREATE POLICY "guests delete own reservation" ON public.reservations FOR DELETE TO authenticated
  USING (guest_id = auth.uid() AND status <> 'confirmed');
DROP POLICY IF EXISTS "guests update own reservation" ON public.reservations;
CREATE POLICY "guests update own reservation" ON public.reservations FOR UPDATE TO authenticated
  USING (guest_id = auth.uid() AND status <> 'confirmed')
  WITH CHECK (guest_id = auth.uid());