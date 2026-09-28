REVOKE EXECUTE ON FUNCTION public.sync_household_rsvp_in(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.celebration_features(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.celebration_has_feature(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_household_rsvp_in(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.celebration_features(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.celebration_has_feature(uuid, text) TO authenticated, service_role;