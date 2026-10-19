CREATE OR REPLACE FUNCTION public.host_regroup_family_members(_invite_id uuid, _source text, _member_ids uuid[], _target_id uuid DEFAULT NULL, _new_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.families; dst public.families; names text[]; users uuid[]; source_users uuid[]; all_moved boolean; target_user uuid; t text; n integer;
BEGIN
 IF NOT public.is_celebration_host(_invite_id) THEN RAISE EXCEPTION 'Only this celebration''s hosts can regroup families'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_invite_id::text));
 SELECT * INTO src FROM public.families WHERE invite_id=_invite_id AND name=_source FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source family not found'; END IF;
 SELECT count(*) INTO n FROM public.invite_codes WHERE invite_id=_invite_id AND household=_source AND id=ANY(_member_ids);
 IF n=0 OR n<>cardinality(_member_ids) THEN RAISE EXCEPTION 'Select valid members from this family'; END IF;
 SELECT array_agg(guest_name), array_agg(claimed_by) FILTER (WHERE claimed_by IS NOT NULL) INTO names,users FROM public.invite_codes WHERE invite_id=_invite_id AND id=ANY(_member_ids);
 SELECT array_agg(claimed_by) FILTER (WHERE claimed_by IS NOT NULL) INTO source_users FROM public.invite_codes WHERE invite_id=_invite_id AND household=_source;
 all_moved := NOT EXISTS(SELECT 1 FROM public.invite_codes WHERE invite_id=_invite_id AND household=_source AND NOT(id=ANY(_member_ids)));
 IF EXISTS(SELECT 1 FROM public.invite_codes WHERE claimed_by=ANY(coalesce(users,ARRAY[]::uuid[])) AND invite_id<>_invite_id) THEN RAISE EXCEPTION 'A selected account belongs to another celebration; regrouping requires host assistance'; END IF;
 IF EXISTS(SELECT 1 FROM public.guest_passports WHERE invite_id=_invite_id AND household=_source AND (all_moved OR person_name=ANY(names)) AND doc_path IS NOT NULL) THEN RAISE EXCEPTION 'Download and remove the selected passport files before regrouping, then upload them to the new family'; END IF;
 IF NOT all_moved AND EXISTS(SELECT 1 FROM public.invite_codes a JOIN public.invite_codes b ON lower(trim(a.email))=lower(trim(b.email)) WHERE a.invite_id=_invite_id AND b.invite_id=_invite_id AND a.id=ANY(_member_ids) AND b.household=_source AND NOT(b.id=ANY(_member_ids)) AND trim(a.email)<>'') THEN RAISE EXCEPTION 'Selected members share an email with someone staying behind; give them separate emails first'; END IF;
 IF NOT all_moved AND (EXISTS(SELECT 1 FROM public.travel_plans WHERE invite_id=_invite_id AND household=_source AND ((coalesce(cardinality(travellers),0)=0 AND guest_name IS NULL) OR (travellers && names AND NOT travellers <@ names))) OR EXISTS(SELECT 1 FROM public.guest_stays WHERE invite_id=_invite_id AND household=_source AND guest_name IS NULL) OR EXISTS(SELECT 1 FROM public.guest_transport WHERE invite_id=_invite_id AND household=_source AND guest_name IS NULL) OR EXISTS(SELECT 1 FROM public.fee_payments WHERE invite_id=_invite_id AND household=_source)) THEN RAISE EXCEPTION 'Separate shared travel batches, unnamed stays/transport and family payments before splitting this family'; END IF;
 IF _target_id IS NOT NULL THEN
  SELECT * INTO dst FROM public.families WHERE id=_target_id AND invite_id=_invite_id FOR UPDATE;
  IF NOT FOUND OR dst.id=src.id THEN RAISE EXCEPTION 'Choose another family in this celebration'; END IF;
 ELSE
  IF _new_name IS NULL OR length(trim(_new_name))<2 OR length(trim(_new_name))>80 THEN RAISE EXCEPTION 'Enter a family name between 2 and 80 characters'; END IF;
  IF EXISTS(SELECT 1 FROM public.families WHERE invite_id=_invite_id AND lower(name)=lower(trim(_new_name))) THEN RAISE EXCEPTION 'That family name already exists'; END IF;
  INSERT INTO public.families(name,code,email,invite_id,signup_link_id,needs_wardrobe,branding_preset_id,travel_need,prepaid_checkin_date,prepaid_checkout_date,extra_nights_paid_by)
  VALUES(trim(_new_name),'FAMILY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),NULL,_invite_id,src.signup_link_id,src.needs_wardrobe,src.branding_preset_id,src.travel_need,src.prepaid_checkin_date,src.prepaid_checkout_date,src.extra_nights_paid_by) RETURNING * INTO dst;
 END IF;
 IF EXISTS(SELECT 1 FROM public.invite_codes WHERE invite_id=_invite_id AND household=dst.name AND lower(trim(guest_name)) IN (SELECT lower(trim(x)) FROM unnest(names) x)) THEN RAISE EXCEPTION 'The destination already has a member with the same name; rename them before regrouping'; END IF;
 SELECT claimed_by INTO target_user FROM public.invite_codes WHERE invite_id=_invite_id AND household=dst.name AND claimed_by IS NOT NULL LIMIT 1;
 target_user := coalesce(target_user,users[1]);
 IF EXISTS(SELECT 1 FROM public.reservations WHERE invite_id=_invite_id AND guest_id=ANY(coalesce(source_users,ARRAY[]::uuid[])) AND guest_name=ANY(names) AND NOT(guest_id=ANY(coalesce(users,ARRAY[]::uuid[])))) AND target_user IS NULL THEN RAISE EXCEPTION 'Move a registered family member with these guests so their proxy outfit choices remain accessible'; END IF;
 IF EXISTS(SELECT 1 FROM public.reservations WHERE invite_id=_invite_id AND guest_id=ANY(coalesce(users,ARRAY[]::uuid[])) AND guest_name IS NOT NULL AND NOT(guest_name=ANY(names))) THEN RAISE EXCEPTION 'This account selected outfits for members staying behind; move those members together'; END IF;
 UPDATE public.reservations SET guest_id=target_user WHERE invite_id=_invite_id AND guest_id=ANY(coalesce(source_users,ARRAY[]::uuid[])) AND guest_name=ANY(names) AND NOT(guest_id=ANY(coalesce(users,ARRAY[]::uuid[])));
 UPDATE public.measurements SET guest_id=target_user WHERE target_user IS NOT NULL AND invite_id=_invite_id AND guest_id=ANY(coalesce(source_users,ARRAY[]::uuid[])) AND guest_name=ANY(names) AND NOT(guest_id=ANY(coalesce(users,ARRAY[]::uuid[])));
 INSERT INTO public.household_event_invites(household,event_id,outfit_selection,invite_id)
 SELECT dst.name,event_id,outfit_selection,_invite_id FROM public.household_event_invites WHERE invite_id=_invite_id AND household=_source
 ON CONFLICT(household,event_id) DO UPDATE SET outfit_selection=household_event_invites.outfit_selection OR excluded.outfit_selection;
 UPDATE public.invite_codes SET household=dst.name,family_id=dst.id WHERE invite_id=_invite_id AND id=ANY(_member_ids);
 UPDATE public.profiles SET household=dst.name WHERE id=ANY(coalesce(users,ARRAY[]::uuid[])) AND household=_source;
 UPDATE public.room_assignments SET household=dst.name WHERE invite_id=_invite_id AND household=_source AND (all_moved OR guest_name=ANY(names));
 UPDATE public.guest_passports SET household=dst.name WHERE invite_id=_invite_id AND household=_source AND (all_moved OR person_name=ANY(names));
 UPDATE public.guest_stays SET household=dst.name WHERE invite_id=_invite_id AND household=_source AND (all_moved OR guest_name=ANY(names));
 UPDATE public.guest_transport SET household=dst.name WHERE invite_id=_invite_id AND household=_source AND (all_moved OR guest_name=ANY(names));
 UPDATE public.travel_plans SET household=dst.name WHERE invite_id=_invite_id AND household=_source AND (all_moved OR guest_name=ANY(names) OR (cardinality(travellers)>0 AND travellers <@ names));
 IF all_moved THEN
  FOREACH t IN ARRAY ARRAY['family_notes','guest_messages','inbound_unmatched','fee_payments'] LOOP
   EXECUTE format('UPDATE public.%I SET household=$1 WHERE invite_id=$2 AND household=$3',t) USING dst.name,_invite_id,_source;
  END LOOP;
  INSERT INTO public.event_attendance(household,event_id,attending,guest_count,invite_id)
  SELECT dst.name,event_id,attending,guest_count,_invite_id FROM public.event_attendance WHERE invite_id=_invite_id AND household=_source
  ON CONFLICT(household,event_id) DO UPDATE SET attending=event_attendance.attending OR excluded.attending,guest_count=event_attendance.guest_count+excluded.guest_count;
  DELETE FROM public.event_attendance WHERE invite_id=_invite_id AND household=_source;
  DELETE FROM public.household_event_invites WHERE invite_id=_invite_id AND household=_source;
  DELETE FROM public.families WHERE id=src.id AND invite_id=_invite_id;
 ELSE
  UPDATE public.event_attendance SET guest_count=least(guest_count,(SELECT count(*) FROM public.invite_codes WHERE invite_id=_invite_id AND household=_source)) WHERE invite_id=_invite_id AND household=_source;
 END IF;
 INSERT INTO public.family_notes(invite_id,household,body,author_id,is_change_log) VALUES(_invite_id,dst.name,'Host moved '||array_to_string(names,', ')||' from '||_source||'. Review event replies, travel settings and prepaid dates.',auth.uid(),true);
 RETURN jsonb_build_object('household',dst.name,'moved',n);
END $$;
REVOKE ALL ON FUNCTION public.host_regroup_family_members(uuid,text,uuid[],uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.host_regroup_family_members(uuid,text,uuid[],uuid,text) TO authenticated;