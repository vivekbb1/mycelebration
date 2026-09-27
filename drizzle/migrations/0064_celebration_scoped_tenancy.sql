-- ===== Phase 1: celebration membership =====
CREATE TABLE public.celebration_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'host' CHECK (role IN ('owner','host')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.celebration_hosts TO authenticated;
GRANT ALL ON public.celebration_hosts TO service_role;
ALTER TABLE public.celebration_hosts ENABLE ROW LEVEL SECURITY;

INSERT INTO public.celebration_hosts (invite_id, user_id, role)
SELECT i.id, r.user_id, 'owner' FROM public.invites i CROSS JOIN public.user_roles r WHERE r.role = 'admin'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.my_celebration_ids()
RETURNS TABLE(invite_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.invite_id FROM public.celebration_hosts h WHERE h.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_celebration_host(_invite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR (_invite_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.celebration_hosts h WHERE h.invite_id = _invite_id AND h.user_id = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.is_celebration_owner(_invite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.celebration_hosts h WHERE h.invite_id = _invite_id AND h.user_id = auth.uid() AND h.role = 'owner')
$$;

CREATE OR REPLACE FUNCTION public.is_any_host()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.celebration_hosts WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.my_guest_invite_ids()
RETURNS TABLE(invite_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT COALESCE(i.invite_id, f.invite_id)
  FROM public.invite_codes i LEFT JOIN public.families f ON f.id = i.family_id
  WHERE i.claimed_by = auth.uid() AND COALESCE(i.invite_id, f.invite_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.is_guest_of(_invite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _invite_id IS NOT NULL AND _invite_id IN (SELECT invite_id FROM public.my_guest_invite_ids())
$$;

CREATE OR REPLACE FUNCTION public.is_my_household(_household text, _invite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _household IS NOT NULL AND _household = public.my_household() AND public.is_guest_of(_invite_id)
$$;

CREATE OR REPLACE FUNCTION public.code_celebration(_code_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(i.invite_id, f.invite_id) FROM public.invite_codes i
  LEFT JOIN public.families f ON f.id = i.family_id WHERE i.id = _code_id
$$;

CREATE OR REPLACE FUNCTION public.default_celebration_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; n int;
BEGIN
  SELECT count(*), min(invite_id::text)::uuid INTO n, v FROM public.celebration_hosts WHERE user_id = auth.uid();
  IF n = 1 THEN RETURN v; END IF;
  IF n = 0 THEN
    SELECT count(*), min(invite_id::text)::uuid INTO n, v FROM public.my_guest_invite_ids();
    IF n = 1 THEN RETURN v; END IF;
  END IF;
  RETURN NULL;
END $$;

-- Boutique members can see celebrations their boutique is linked to
CREATE TABLE public.boutique_celebrations (
  boutique_id uuid NOT NULL REFERENCES public.boutiques(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (boutique_id, invite_id)
);
GRANT SELECT, INSERT, DELETE ON public.boutique_celebrations TO authenticated;
GRANT ALL ON public.boutique_celebrations TO service_role;
ALTER TABLE public.boutique_celebrations ENABLE ROW LEVEL SECURITY;
INSERT INTO public.boutique_celebrations (boutique_id, invite_id)
SELECT b.id, i.id FROM public.boutiques b CROSS JOIN public.invites i ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.boutique_sees_celebration(_invite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.boutique_celebrations bc
    JOIN public.boutique_members m ON m.boutique_id = bc.boutique_id
    WHERE bc.invite_id = _invite_id AND m.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.boutique_host_can_manage(_boutique_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.boutique_celebrations bc
    WHERE bc.boutique_id = _boutique_id AND bc.invite_id IN (SELECT invite_id FROM public.my_celebration_ids()))
$$;

-- ===== Phase 2: invite_id on every tenant table =====
ALTER TABLE public.event_attendance ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.household_event_invites ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.guest_messages ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.travel_plans ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.guest_passports ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.measurements ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.outfit_favourites ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.outfit_feeds ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.outfit_feed_hidden ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.outfit_import_jobs ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.logistics ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.inbound_unmatched ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.host_invites ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
ALTER TABLE public.branding_presets ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;

-- Backfill: every existing row belongs to the single existing celebration
DO $$
DECLARE kid uuid; t text;
BEGIN
  SELECT id INTO kid FROM public.invites ORDER BY created_at LIMIT 1;
  IF kid IS NULL THEN RETURN; END IF;
  FOREACH t IN ARRAY ARRAY['event_attendance','household_event_invites','guest_messages','travel_plans',
    'guest_passports','measurements','reservations','outfits','outfit_favourites','outfit_feeds',
    'outfit_feed_hidden','outfit_import_jobs','logistics','inbound_unmatched','host_invites','branding_presets',
    'events','families','invite_codes','event_fees','fee_payments','guest_stays','guest_tags','guest_transport',
    'budget_items','vendors','whatsapp_broadcasts']
  LOOP
    EXECUTE format('UPDATE public.%I SET invite_id = $1 WHERE invite_id IS NULL', t) USING kid;
  END LOOP;
END $$;

-- Per-celebration uniqueness instead of global
ALTER TABLE public.families DROP CONSTRAINT IF EXISTS families_name_key;
ALTER TABLE public.families ADD CONSTRAINT families_invite_name_key UNIQUE (invite_id, name);
ALTER TABLE public.guest_passports DROP CONSTRAINT IF EXISTS guest_passports_household_person_name_key;
ALTER TABLE public.guest_passports ADD CONSTRAINT guest_passports_invite_household_person_key UNIQUE (invite_id, household, person_name);
ALTER TABLE public.logistics DROP CONSTRAINT IF EXISTS logistics_singleton_key;
ALTER TABLE public.logistics ADD CONSTRAINT logistics_invite_key UNIQUE (invite_id);

-- Fill invite_id on insert from the row's parent, household, or the caller's single celebration
CREATE OR REPLACE FUNCTION public.fill_invite_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := to_jsonb(NEW); v uuid; n int;
BEGIN
  IF (j->>'invite_id') IS NOT NULL THEN RETURN NEW; END IF;
  IF (j->>'event_id') IS NOT NULL THEN
    SELECT invite_id INTO v FROM public.events WHERE id = (j->>'event_id')::uuid;
  END IF;
  IF v IS NULL AND (j->>'outfit_id') IS NOT NULL THEN
    SELECT invite_id INTO v FROM public.outfits WHERE id = (j->>'outfit_id')::uuid;
  END IF;
  IF v IS NULL AND (j->>'family_id') IS NOT NULL THEN
    SELECT invite_id INTO v FROM public.families WHERE id = (j->>'family_id')::uuid;
  END IF;
  IF v IS NULL AND (j->>'household') IS NOT NULL THEN
    IF auth.uid() IS NULL THEN
      SELECT count(DISTINCT x), min(x::text)::uuid INTO n, v FROM (
        SELECT COALESCE(i.invite_id, f.invite_id) x FROM public.invite_codes i
        LEFT JOIN public.families f ON f.id = i.family_id WHERE i.household = j->>'household'
        UNION SELECT invite_id FROM public.families WHERE name = j->>'household') s WHERE x IS NOT NULL;
      IF n <> 1 THEN v := NULL; END IF;
    ELSE
      SELECT x INTO v FROM (
        SELECT COALESCE(i.invite_id, f.invite_id) x FROM public.invite_codes i
        LEFT JOIN public.families f ON f.id = i.family_id WHERE i.household = j->>'household'
        UNION SELECT invite_id FROM public.families WHERE name = j->>'household') s
      WHERE x IN (SELECT invite_id FROM public.my_celebration_ids() UNION SELECT invite_id FROM public.my_guest_invite_ids())
      LIMIT 1;
    END IF;
  END IF;
  IF v IS NULL THEN v := public.default_celebration_id(); END IF;
  NEW := jsonb_populate_record(NEW, jsonb_build_object('invite_id', v));
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['event_attendance','household_event_invites','guest_messages','travel_plans',
    'guest_passports','measurements','reservations','outfits','outfit_favourites','outfit_feeds',
    'outfit_feed_hidden','outfit_import_jobs','logistics','host_invites','branding_presets',
    'events','families','invite_codes','event_fees','fee_payments','guest_stays','guest_tags','guest_transport',
    'budget_items','vendors','whatsapp_broadcasts']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS aa_fill_invite_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER aa_fill_invite_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fill_invite_id()', t);
  END LOOP;
END $$;

-- New celebration: creator becomes owner. New boutique: linked to caller's celebration.
CREATE OR REPLACE FUNCTION public.invites_add_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    INSERT INTO public.celebration_hosts (invite_id, user_id, role) VALUES (NEW.id, auth.uid(), 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invites_add_owner ON public.invites;
CREATE TRIGGER invites_add_owner BEFORE INSERT ON public.invites FOR EACH ROW EXECUTE FUNCTION public.invites_add_owner();

CREATE OR REPLACE FUNCTION public.boutiques_link_celebration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid := public.default_celebration_id();
BEGIN
  IF v IS NOT NULL THEN
    INSERT INTO public.boutique_celebrations (boutique_id, invite_id) VALUES (NEW.id, v) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS boutiques_link_celebration ON public.boutiques;
CREATE TRIGGER boutiques_link_celebration BEFORE INSERT ON public.boutiques FOR EACH ROW EXECUTE FUNCTION public.boutiques_link_celebration();

-- Keep the "is a host somewhere" marker in user_roles in step with memberships (UI only; grants no data)
CREATE OR REPLACE FUNCTION public.sync_host_marker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.celebration_hosts WHERE user_id = OLD.user_id)
     AND NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = OLD.user_id) THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'admin';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER celebration_hosts_marker AFTER INSERT OR DELETE ON public.celebration_hosts
FOR EACH ROW EXECUTE FUNCTION public.sync_host_marker();

-- Never remove the last owner
CREATE OR REPLACE FUNCTION public.guard_last_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner')
     AND EXISTS (SELECT 1 FROM public.invites WHERE id = OLD.invite_id)
     AND NOT EXISTS (SELECT 1 FROM public.celebration_hosts WHERE invite_id = OLD.invite_id AND role = 'owner' AND id <> OLD.id) THEN
    RAISE EXCEPTION 'A celebration needs at least one owner';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER celebration_hosts_last_owner BEFORE UPDATE OR DELETE ON public.celebration_hosts
FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner();

-- Guests' events: only within celebrations they belong to
CREATE OR REPLACE FUNCTION public.my_event_ids()
RETURNS TABLE(event_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT i.event_id FROM public.household_event_invites i
    WHERE i.household = public.my_household() AND i.invite_id IN (SELECT invite_id FROM public.my_guest_invite_ids())
  )
  SELECT e.id FROM public.events e
  WHERE e.invite_id IN (SELECT invite_id FROM public.my_guest_invite_ids())
    AND (NOT EXISTS (SELECT 1 FROM mine) OR e.id IN (SELECT event_id FROM mine))
$$;

CREATE OR REPLACE FUNCTION public.household_rsvp_summary()
RETURNS TABLE(household text, status text, events_yes integer, events_answered integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.household,
         CASE WHEN count(*) FILTER (WHERE a.attending) > 0 THEN 'yes' ELSE 'no' END,
         count(*) FILTER (WHERE a.attending)::int, count(*)::int
  FROM public.event_attendance a
  WHERE public.is_celebration_host(a.invite_id) OR public.is_my_household(a.household, a.invite_id)
  GROUP BY a.household
$$;

CREATE OR REPLACE FUNCTION public.household_members()
RETURNS TABLE(name text, gender text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(btrim(i.guest_name), ''), 'Guest'), i.gender
  FROM public.invite_codes i
  WHERE i.household IS NOT NULL AND i.household = public.my_household()
    AND i.invite_id IN (SELECT invite_id FROM public.my_guest_invite_ids())
  ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.my_family_needs_wardrobe()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT f.needs_wardrobe FROM public.families f
    WHERE f.name = public.my_household() AND f.invite_id IN (SELECT invite_id FROM public.my_guest_invite_ids()) LIMIT 1), TRUE)
$$;

CREATE OR REPLACE FUNCTION public.sync_household_rsvp_in(_household text, _invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _yes int; _answered int; _status text;
BEGIN
  IF _household IS NULL OR btrim(_household) = '' THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE attending), count(*) INTO _yes, _answered
  FROM public.event_attendance WHERE household = _household AND (_invite_id IS NULL OR invite_id = _invite_id);
  _status := CASE WHEN _answered = 0 THEN 'pending' WHEN _yes > 0 THEN 'yes' ELSE 'no' END;
  UPDATE public.invite_codes SET rsvp_status = _status, rsvp_recorded_at = now()
  WHERE household = _household AND (_invite_id IS NULL OR invite_id = _invite_id)
    AND coalesce(rsvp_status, 'pending') <> _status;
  UPDATE public.profiles p SET rsvp_status = _status, rsvp_updated_at = now()
  WHERE p.household = _household AND coalesce(p.rsvp_status, 'pending') <> _status
    AND (_invite_id IS NULL OR EXISTS (SELECT 1 FROM public.invite_codes c WHERE c.claimed_by = p.id AND c.invite_id = _invite_id));
END $$;

CREATE OR REPLACE FUNCTION public.sync_household_rsvp(_household text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_household_rsvp_in(_household, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.event_attendance_rsvp_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_household_rsvp_in(OLD.household, OLD.invite_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_household_rsvp_in(NEW.household, NEW.invite_id);
  IF TG_OP = 'UPDATE' AND OLD.household IS DISTINCT FROM NEW.household THEN
    PERFORM public.sync_household_rsvp_in(OLD.household, OLD.invite_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_profile_household()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN RETURN NEW; END IF;
  IF auth.uid() <> OLD.id AND EXISTS (SELECT 1 FROM public.invite_codes c
       WHERE c.claimed_by = OLD.id AND public.is_celebration_host(c.invite_id)) THEN
    RETURN NEW;
  END IF;
  IF OLD.household IS NOT NULL AND OLD.household <> '' THEN NEW.household := OLD.household; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.apply_due_guest_transfers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; moved int := 0;
BEGIN
  FOR r IN SELECT * FROM public.guest_host_transfers
    WHERE applied_at IS NULL AND effective_on <= current_date
      AND public.is_celebration_host(public.code_celebration(invite_id))
    ORDER BY effective_on, created_at
  LOOP
    IF r.from_host IS NOT NULL THEN
      DELETE FROM public.guest_hosts WHERE invite_id = r.invite_id AND host_id = r.from_host;
    END IF;
    INSERT INTO public.guest_hosts (invite_id, host_id, note) VALUES (r.invite_id, r.to_host, r.reason)
    ON CONFLICT (invite_id, host_id) DO NOTHING;
    UPDATE public.guest_host_transfers SET applied_at = now() WHERE id = r.id;
    moved := moved + 1;
  END LOOP;
  RETURN moved;
END $$;

-- Hosts may see profiles of their celebration's guests and co-hosts
CREATE OR REPLACE FUNCTION public.host_can_see_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.invite_codes c LEFT JOIN public.families f ON f.id = c.family_id
               WHERE c.claimed_by = _user_id
                 AND COALESCE(c.invite_id, f.invite_id) IN (SELECT invite_id FROM public.my_celebration_ids()))
    OR EXISTS (SELECT 1 FROM public.celebration_hosts h
               WHERE h.user_id = _user_id AND h.invite_id IN (SELECT invite_id FROM public.my_celebration_ids()))
$$;

-- ===== Rewrite every policy =====
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    AND tablename NOT IN ('plan_requests','host_subscriptions','host_addons','platform_admins','addons','plans','email_delivery_events','import_worker_key','celebration_hosts','boutique_celebrations')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Hosts can read add-ons" ON public.addons;
DROP POLICY IF EXISTS "Hosts can read plans" ON public.plans;
DROP POLICY IF EXISTS "Hosts read delivery events" ON public.email_delivery_events;

CREATE POLICY "Hosts can read add-ons" ON public.addons FOR SELECT TO authenticated USING (public.is_any_host());
CREATE POLICY "Hosts can read plans" ON public.plans FOR SELECT TO authenticated USING (public.is_any_host());
CREATE POLICY "Hosts read delivery events for their guests" ON public.email_delivery_events FOR SELECT TO authenticated
USING (public.is_platform_admin() OR EXISTS (
  SELECT 1 FROM public.invite_codes c WHERE lower(c.email) = email_delivery_events.recipient AND public.is_celebration_host(c.invite_id))
  OR EXISTS (SELECT 1 FROM public.families f WHERE lower(f.email) = email_delivery_events.recipient AND public.is_celebration_host(f.invite_id)));

-- membership
CREATE POLICY "See memberships of my celebrations" ON public.celebration_hosts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_celebration_host(invite_id));
CREATE POLICY "Owners add hosts" ON public.celebration_hosts FOR INSERT TO authenticated WITH CHECK (public.is_celebration_owner(invite_id));
CREATE POLICY "Owners change hosts" ON public.celebration_hosts FOR UPDATE TO authenticated USING (public.is_celebration_owner(invite_id)) WITH CHECK (public.is_celebration_owner(invite_id));
CREATE POLICY "Owners remove hosts, hosts leave" ON public.celebration_hosts FOR DELETE TO authenticated USING (public.is_celebration_owner(invite_id) OR user_id = auth.uid());

CREATE POLICY "See boutique links of my celebrations" ON public.boutique_celebrations FOR SELECT TO authenticated
USING (public.is_celebration_host(invite_id) OR public.is_boutique_member(boutique_id));
CREATE POLICY "Hosts link boutiques" ON public.boutique_celebrations FOR INSERT TO authenticated WITH CHECK (public.is_celebration_host(invite_id));
CREATE POLICY "Hosts unlink boutiques" ON public.boutique_celebrations FOR DELETE TO authenticated USING (public.is_celebration_host(invite_id));

-- celebrations
CREATE POLICY "Hosts and guests read their celebrations" ON public.invites FOR SELECT TO authenticated
USING (public.is_celebration_host(id) OR public.is_guest_of(id) OR created_by = auth.uid());
CREATE POLICY "Signed-in users create a celebration" ON public.invites FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Hosts update their celebration" ON public.invites FOR UPDATE TO authenticated USING (public.is_celebration_host(id)) WITH CHECK (public.is_celebration_host(id));
CREATE POLICY "Owners delete their celebration" ON public.invites FOR DELETE TO authenticated USING (public.is_celebration_owner(id));

-- standard host-managed tables keyed by invite_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['events','outfits','invite_codes','families','event_attendance','household_event_invites',
    'guest_messages','travel_plans','guest_passports','guest_stays','guest_transport','event_fees','fee_payments',
    'guest_tags','logistics','outfit_feeds','outfit_feed_hidden','outfit_import_jobs','host_invites','reservations','inbound_unmatched']
  LOOP
    EXECUTE format('CREATE POLICY "Hosts manage their celebration" ON public.%I FOR ALL TO authenticated USING (public.is_celebration_host(invite_id)) WITH CHECK (public.is_celebration_host(invite_id))', t);
  END LOOP;
END $$;

CREATE POLICY "Hosts manage budget items" ON public.budget_items FOR ALL TO authenticated
USING (public.is_celebration_host(invite_id) AND (public.my_features() ? 'budgeting' OR public.my_features() ? 'all'))
WITH CHECK (public.is_celebration_host(invite_id) AND (public.my_features() ? 'budgeting' OR public.my_features() ? 'all'));
CREATE POLICY "Hosts manage vendors" ON public.vendors FOR ALL TO authenticated
USING (public.is_celebration_host(invite_id) AND (public.my_features() ? 'vendor_management' OR public.my_features() ? 'all'))
WITH CHECK (public.is_celebration_host(invite_id) AND (public.my_features() ? 'vendor_management' OR public.my_features() ? 'all'));

CREATE POLICY "Hosts read broadcasts" ON public.whatsapp_broadcasts FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));
CREATE POLICY "Hosts log broadcasts" ON public.whatsapp_broadcasts FOR INSERT TO authenticated WITH CHECK (public.is_celebration_host(invite_id));

CREATE POLICY "Hosts manage guest communications" ON public.guest_communications FOR ALL TO authenticated
USING (public.is_celebration_host(public.code_celebration(invite_id))) WITH CHECK (public.is_celebration_host(public.code_celebration(invite_id)));
CREATE POLICY "Hosts manage guest hosts" ON public.guest_hosts FOR ALL TO authenticated
USING (public.is_celebration_host(public.code_celebration(invite_id))) WITH CHECK (public.is_celebration_host(public.code_celebration(invite_id)));
CREATE POLICY "Hosts manage guest transfers" ON public.guest_host_transfers FOR ALL TO authenticated
USING (public.is_celebration_host(public.code_celebration(invite_id))) WITH CHECK (public.is_celebration_host(public.code_celebration(invite_id)));
CREATE POLICY "Hosts manage tag hosts" ON public.guest_tag_hosts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.guest_tags g WHERE g.id = tag_id AND public.is_celebration_host(g.invite_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.guest_tags g WHERE g.id = tag_id AND public.is_celebration_host(g.invite_id)));
CREATE POLICY "Hosts manage import items" ON public.outfit_import_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.outfit_import_jobs j WHERE j.id = job_id AND public.is_celebration_host(j.invite_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.outfit_import_jobs j WHERE j.id = job_id AND public.is_celebration_host(j.invite_id)));

-- guests
CREATE POLICY "Guests read their events" ON public.events FOR SELECT TO authenticated
USING (id IN (SELECT event_id FROM public.my_event_ids()) OR public.boutique_sees_celebration(invite_id));
CREATE POLICY "Guests read their celebration's looks" ON public.outfits FOR SELECT TO authenticated
USING ((public.is_guest_of(invite_id) AND (event_id IS NULL OR event_id IN (SELECT event_id FROM public.my_event_ids())))
  OR (boutique_id IS NOT NULL AND public.is_boutique_member(boutique_id)));
CREATE POLICY "Guests read own claimed code" ON public.invite_codes FOR SELECT TO authenticated USING (claimed_by = auth.uid());
CREATE POLICY "Guests read own family" ON public.families FOR SELECT TO authenticated USING (public.is_my_household(name, invite_id));
CREATE POLICY "Guests manage own attendance" ON public.event_attendance FOR ALL TO authenticated
USING (public.is_my_household(household, invite_id)) WITH CHECK (public.is_my_household(household, invite_id));
CREATE POLICY "Guests read own event invites" ON public.household_event_invites FOR SELECT TO authenticated USING (public.is_my_household(household, invite_id));
CREATE POLICY "Guests read household messages" ON public.guest_messages FOR SELECT TO authenticated USING (public.is_my_household(household, invite_id));
CREATE POLICY "Guests write household messages" ON public.guest_messages FOR INSERT TO authenticated
WITH CHECK (from_host = false AND author_id = auth.uid() AND public.is_my_household(household, invite_id));
CREATE POLICY "Guests manage own travel" ON public.travel_plans FOR ALL TO authenticated
USING (public.is_my_household(household, invite_id)) WITH CHECK (public.is_my_household(household, invite_id));
CREATE POLICY "Guests manage own passports" ON public.guest_passports FOR ALL TO authenticated
USING (public.is_my_household(household, invite_id)) WITH CHECK (public.is_my_household(household, invite_id));
CREATE POLICY "Guests read own stay" ON public.guest_stays FOR SELECT TO authenticated USING (public.is_my_household(household, invite_id));
CREATE POLICY "Guests read own transport" ON public.guest_transport FOR SELECT TO authenticated USING (public.is_my_household(household, invite_id));
CREATE POLICY "Guests see fees for their events" ON public.event_fees FOR SELECT TO authenticated
USING (audience = 'guest' AND active AND public.is_guest_of(invite_id)
  AND (event_id IS NULL OR event_id IN (SELECT event_id FROM public.my_event_ids())));
CREATE POLICY "Guests see own payments" ON public.fee_payments FOR SELECT TO authenticated
USING (payer_kind = 'guest' AND public.is_my_household(household, invite_id));
CREATE POLICY "Guests record own payment" ON public.fee_payments FOR INSERT TO authenticated
WITH CHECK (payer_kind = 'guest' AND confirmed_at IS NULL AND public.is_my_household(household, invite_id));
CREATE POLICY "Guests and boutiques read logistics" ON public.logistics FOR SELECT TO authenticated
USING (public.is_guest_of(invite_id) OR public.boutique_sees_celebration(invite_id));

-- measurements / reservations / favourites
CREATE POLICY "Own measurements" ON public.measurements FOR ALL TO authenticated USING (guest_id = auth.uid()) WITH CHECK (guest_id = auth.uid());
CREATE POLICY "Boutiques read measurements for their orders" ON public.measurements FOR SELECT TO authenticated USING (public.can_boutique_see_guest(guest_id));
CREATE POLICY "Hosts read measurements" ON public.measurements FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));
CREATE POLICY "Guests read own reservations" ON public.reservations FOR SELECT TO authenticated USING (guest_id = auth.uid());
CREATE POLICY "Guests create own reservation" ON public.reservations FOR INSERT TO authenticated
WITH CHECK (guest_id = auth.uid() AND public.is_guest_of(invite_id));
CREATE POLICY "Guests update own reservation" ON public.reservations FOR UPDATE TO authenticated
USING (guest_id = auth.uid() AND status <> 'confirmed') WITH CHECK (guest_id = auth.uid());
CREATE POLICY "Guests delete own reservation" ON public.reservations FOR DELETE TO authenticated USING (guest_id = auth.uid() AND status <> 'confirmed');
CREATE POLICY "Boutiques read their orders" ON public.reservations FOR SELECT TO authenticated USING (public.can_boutique_see_outfit(outfit_id));
CREATE POLICY "Boutiques update their orders" ON public.reservations FOR UPDATE TO authenticated
USING (public.can_boutique_see_outfit(outfit_id)) WITH CHECK (public.can_boutique_see_outfit(outfit_id));
CREATE POLICY "Own favourites" ON public.outfit_favourites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Hosts read favourites" ON public.outfit_favourites FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));

-- boutiques
CREATE POLICY "Hosts manage their boutiques" ON public.boutiques FOR ALL TO authenticated
USING (public.boutique_host_can_manage(id)) WITH CHECK (public.is_any_host());
CREATE POLICY "Stylists read own boutique" ON public.boutiques FOR SELECT TO authenticated USING (public.is_boutique_member(id));
CREATE POLICY "Hosts manage boutique members" ON public.boutique_members FOR ALL TO authenticated
USING (public.boutique_host_can_manage(boutique_id)) WITH CHECK (public.boutique_host_can_manage(boutique_id));
CREATE POLICY "Stylists read own membership" ON public.boutique_members FOR SELECT TO authenticated USING (user_id = auth.uid());

-- branding presets
CREATE POLICY "Hosts read presets" ON public.branding_presets FOR SELECT TO authenticated
USING (public.is_celebration_host(invite_id) OR (invite_id IS NULL AND public.is_any_host()));
CREATE POLICY "Hosts manage their presets" ON public.branding_presets FOR ALL TO authenticated
USING (public.is_celebration_host(invite_id)) WITH CHECK (public.is_celebration_host(invite_id));

-- app-wide settings (per-celebration versions come next): operator only for writes
CREATE POLICY "Anyone reads site branding" ON public.branding FOR SELECT TO anon, authenticated USING (id = 'default');
CREATE POLICY "Operator manages branding" ON public.branding FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Anyone reads page wording" ON public.site_content FOR SELECT TO anon, authenticated USING (kind IN ('text','multiline'));
CREATE POLICY "Operator manages wording" ON public.site_content FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Operator manages email settings" ON public.email_settings FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- profiles & roles
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Hosts read their guests and co-hosts" ON public.profiles FOR SELECT TO authenticated USING (public.host_can_see_user(id));
CREATE POLICY "Hosts update their guests" ON public.profiles FOR UPDATE TO authenticated
USING (id <> auth.uid() AND public.host_can_see_user(id)) WITH CHECK (public.host_can_see_user(id));
CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Co-host roles readable" ON public.user_roles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.celebration_hosts h WHERE h.user_id = user_roles.user_id
  AND h.invite_id IN (SELECT invite_id FROM public.my_celebration_ids())));
CREATE POLICY "Operator manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ===== Storage =====
DROP POLICY IF EXISTS "Admins manage event images" ON storage.objects;
DROP POLICY IF EXISTS "Passports delete own family or host" ON storage.objects;
DROP POLICY IF EXISTS "Passports read own family or host" ON storage.objects;
DROP POLICY IF EXISTS "Passports insert own family" ON storage.objects;
DROP POLICY IF EXISTS "Passports update own family" ON storage.objects;

CREATE POLICY "Hosts manage their celebration images" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'event-images' AND (public.is_platform_admin()
  OR (storage.foldername(name))[1] IN (SELECT invite_id::text FROM public.my_celebration_ids())))
WITH CHECK (bucket_id = 'event-images' AND (public.is_platform_admin()
  OR (storage.foldername(name))[1] IN (SELECT invite_id::text FROM public.my_celebration_ids())));

CREATE POLICY "Passports: family and their hosts" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'passports' AND (
  ((storage.foldername(name))[1] IN (SELECT invite_id::text FROM public.my_guest_invite_ids()) AND (storage.foldername(name))[2] = public.my_household())
  OR (storage.foldername(name))[1] IN (SELECT invite_id::text FROM public.my_celebration_ids())
  OR public.is_platform_admin()))
WITH CHECK (bucket_id = 'passports' AND (
  ((storage.foldername(name))[1] IN (SELECT invite_id::text FROM public.my_guest_invite_ids()) AND (storage.foldername(name))[2] = public.my_household())
  OR (storage.foldername(name))[1] IN (SELECT invite_id::text FROM public.my_celebration_ids())
  OR public.is_platform_admin()));

-- helper grants
REVOKE EXECUTE ON FUNCTION public.my_celebration_ids(), public.is_celebration_host(uuid), public.is_celebration_owner(uuid),
  public.is_any_host(), public.my_guest_invite_ids(), public.is_guest_of(uuid), public.is_my_household(text, uuid),
  public.code_celebration(uuid), public.default_celebration_id(), public.boutique_sees_celebration(uuid),
  public.boutique_host_can_manage(uuid), public.host_can_see_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_celebration_ids(), public.is_celebration_host(uuid), public.is_celebration_owner(uuid),
  public.is_any_host(), public.my_guest_invite_ids(), public.is_guest_of(uuid), public.is_my_household(text, uuid),
  public.code_celebration(uuid), public.default_celebration_id(), public.boutique_sees_celebration(uuid),
  public.boutique_host_can_manage(uuid), public.host_can_see_user(uuid) TO authenticated, service_role;