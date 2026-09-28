CREATE OR REPLACE FUNCTION public.my_travel_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT CASE WHEN public.celebration_has_feature(i.id, 'arrivals') THEN jsonb_build_object(
    'need', COALESCE(f.travel_need, i.default_travel_need, 'none'),
    'travel_required', COALESCE(i.travel_required, false),
    'passport_required', COALESCE(i.passport_required, false))
  ELSE jsonb_build_object('need', 'none', 'travel_required', false, 'passport_required', false) END
  FROM public.invites i
  LEFT JOIN public.families f ON f.invite_id = i.id
    AND f.name = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  WHERE i.id IN (SELECT invite_id FROM public.my_guest_invite_ids())
  ORDER BY i.created_at LIMIT 1
$fn$;