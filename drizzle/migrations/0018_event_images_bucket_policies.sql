CREATE POLICY "Admins manage event images"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Signed reads of event images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-images');