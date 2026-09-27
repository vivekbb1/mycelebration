DROP INDEX IF EXISTS public.outfits_source_sku_key;
CREATE UNIQUE INDEX outfits_invite_source_sku_key ON public.outfits (invite_id, source_sku) WHERE source_sku IS NOT NULL;
DROP INDEX IF EXISTS public.travel_plans_household_person_idx;
DROP INDEX IF EXISTS public.travel_plans_one_row_per_person;
CREATE UNIQUE INDEX travel_plans_invite_household_person_key ON public.travel_plans (invite_id, household, COALESCE(guest_name, ''));