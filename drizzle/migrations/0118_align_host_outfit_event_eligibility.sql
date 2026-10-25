CREATE OR REPLACE FUNCTION public.host_choose_outfit(_member uuid, _outfit uuid, _size text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c invite_codes%ROWTYPE; o outfits%ROWTYPE; ev events%ROWTYPE; account uuid; rid uuid;
BEGIN
 SELECT * INTO c FROM invite_codes WHERE id=_member FOR UPDATE;
 IF NOT FOUND OR NOT is_celebration_host(c.invite_id) THEN RAISE EXCEPTION 'Only this celebration''s hosts can choose'; END IF;
 SELECT * INTO o FROM outfits WHERE id=_outfit AND invite_id=c.invite_id FOR UPDATE;
 IF NOT FOUND OR o.event_id IS NULL OR NOT o.is_available THEN RAISE EXCEPTION 'This outfit is unavailable'; END IF;
 SELECT * INTO ev FROM events WHERE id=o.event_id;
 IF ev.outfit_selection IS DISTINCT FROM true OR (
   EXISTS(SELECT 1 FROM household_event_invites h WHERE h.household=c.household AND h.invite_id=c.invite_id)
   AND NOT EXISTS(SELECT 1 FROM household_event_invites h WHERE h.household=c.household AND h.invite_id=c.invite_id AND h.event_id=o.event_id AND h.outfit_selection IS DISTINCT FROM false)
 ) THEN RAISE EXCEPTION 'This person is not offered outfits for this event'; END IF;
 IF NOT member_outfit_allowed(c.id,o.id) THEN RAISE EXCEPTION 'This outfit is outside this person''s assigned collection'; END IF;
 IF c.gender IS NOT NULL AND c.gender<>o.gender THEN RAISE EXCEPTION 'Choose an outfit from this person''s wardrobe'; END IF;
 IF EXISTS(SELECT 1 FROM reservations r JOIN outfits x ON x.id=r.outfit_id WHERE r.member_code_id=c.id AND x.event_id=o.event_id) THEN RAISE EXCEPTION 'This person already has an outfit for this event; existing choices are preserved'; END IF;
 account:=c.claimed_by;
 IF account IS NULL THEN SELECT claimed_by INTO account FROM invite_codes WHERE invite_id=c.invite_id AND household=c.household AND claimed_by IS NOT NULL LIMIT 1; END IF;
 account:=coalesce(account,auth.uid());
 INSERT INTO reservations(invite_id,outfit_id,guest_id,guest_name,member_code_id,status,size_choice,build_size,build_garment) VALUES(c.invite_id,o.id,account,c.guest_name,c.id,'confirmed',nullif(trim(_size),''),nullif(trim(_size),''),o.garment_type) RETURNING id INTO rid;
 RETURN rid;
END $function$;
REVOKE ALL ON FUNCTION public.host_choose_outfit(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_choose_outfit(uuid,uuid,text) TO authenticated, service_role;