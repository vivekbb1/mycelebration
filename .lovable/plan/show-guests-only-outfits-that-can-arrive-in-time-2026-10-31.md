# Show guests only outfits that can arrive in time

## What changes
- Each look gets two numbers: **production days** (vendor making time) and **courier days** (shipping time).
  - Filled in automatically from the Pernia/Kora shop page when it shows "ships in X days".
  - Hosts can type or override them per look, or bulk-set them in Wardrobe → Manage (e.g. all looks from one shop).
- Each celebration gets a **default courier days** value (Setup), used when a look has none. A host can also set a **buffer days** value for fittings/alterations before the event.
- **Guest gallery:** for each event, a look is shown only if
  today + production days + courier days + buffer ≤ event date.
  Looks that can't make it are hidden for that event (they may still appear for a later event).
- Looks with **no delivery info** stay visible (so nothing disappears by accident); Manage shows a "No delivery time" flag so hosts can fill them in.
- Already-reserved looks are never hidden or released.
- Hosts still see everything, with a "Too late for <event>" tag, and can still choose any look for a guest themselves.
- The check is also enforced when a guest reserves, so a stale page can't save a look that's too late.

## Technical details
- Migration: `outfits.production_days int`, `outfits.courier_days int`, `outfits.delivery_source text` (shop/host); `invites.default_courier_days int`, `invites.delivery_buffer_days int default 0`.
- Pure helper `src/lib/delivery-eligibility.ts` (`canArriveInTime(outfit, event, settings, today)`) shared by guest gallery and host tags, with node:test tests (on-time, late, missing data visible, buffer, default courier).
- Extend `enforce_member_outfit_range`/reservation insert trigger with the same rule for guest inserts only; `host_choose_outfit` and existing reservations untouched.
- Pernia/Kora fetchers parse dispatch/lead-time text into `production_days`; host edits set source = host and are not overwritten by the nightly refresh.
- Manage: two fields in look edit, bulk-edit support, "No delivery time" filter.
