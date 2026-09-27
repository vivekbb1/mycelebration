DO $$
DECLARE f text;
BEGIN
  -- Internal-only: triggers and maintenance jobs, callable by nobody through the API.
  FOREACH f IN ARRAY ARRAY[
    'public.apply_due_guest_transfers()',
    'public.event_attendance_rsvp_sync()',
    'public.guard_profile_household()',
    'public.handle_new_user()',
    'public.sync_household_rsvp(text)',
    'public.sync_outfit_availability()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  -- Signed-in only: nothing a visitor without an account should call.
  FOREACH f IN ARRAY ARRAY[
    'public.claim_host_access()',
    'public.claim_invite(text)',
    'public.household_members()',
    'public.household_rsvp_summary()',
    'public.my_branding()',
    'public.my_event_ids()',
    'public.my_family_needs_wardrobe()',
    'public.my_features()',
    'public.my_fees_enabled()',
    'public.my_outfits_paid_by_host()',
    'public.my_pay_instructions()',
    'public.is_platform_admin()',
    'public.has_role(uuid, public.app_role)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;