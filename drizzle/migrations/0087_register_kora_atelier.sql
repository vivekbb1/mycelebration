INSERT INTO public.boutiques (name, city, access_code, notes)
SELECT 'Kora', 'Mumbai', 'KORA-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), 'koranm.com'
WHERE NOT EXISTS (SELECT 1 FROM public.boutiques WHERE name = 'Kora');
INSERT INTO public.boutique_celebrations (boutique_id, invite_id)
SELECT b.id, '52b4a825-a49f-4ba0-804d-5587a3bc45a1'::uuid FROM public.boutiques b
WHERE b.name = 'Kora' AND EXISTS (SELECT 1 FROM public.invites WHERE id = '52b4a825-a49f-4ba0-804d-5587a3bc45a1')
ON CONFLICT DO NOTHING;