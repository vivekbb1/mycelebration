# Rooming list (under Logistics)

## What hosts get
A new **Rooms** tab inside Logistics. Only celebrations with the Logistics package see it; others see the usual upgrade prompt.

1. **Hotels** – pick a hotel from Vendors (category Hotel), or add one in place. Set check-in/out dates for the block.
2. **Room inventory per hotel** – add rooms one by one or in bulk ("20 Deluxe rooms, floors 3–5"). Each room has: category (Deluxe, Suite, etc.), floor, room number, normal beds, max guests, and whether an extra bed is allowed.
3. **Assign guests to rooms** – pick a room and add people from one or more families. Mix families in one room to fill it. Tick "Extra bed" per room. The room shows how full it is (e.g. 3 / 3 + extra bed) and warns when over capacity.
4. **Suggest fill** – one button that places unassigned "Stay" families into free rooms, keeping each family together first, then filling leftover beds. Hosts review before saving.
5. **Rooming list** – table by hotel → floor → room: room number, category, guests, families, extra bed, check-in/out (taken from each family's travel details). Filters by hotel, category, family, unassigned. Download as a spreadsheet (CSV) to send to the hotel.
6. **Family profile + guest view** – the family profile shows their hotel and room; host can change it there. Guests see hotel, room number and dates in "Your stay" once assigned (not who else shares, unless the room only holds their family).

Only families set to "Stay only" or "Stay + pickup" appear for assignment.

## Technical details
- New tables (all with `invite_id`, host-only RLS via `is_celebration_host` + `celebration_has_feature(invite_id,'logistics')`, GRANTs, `fill_invite_id`):
  - `hotel_rooms(id, invite_id, vendor_id→vendors, category, floor, room_number, beds, max_occupancy, extra_bed_allowed, notes)` unique (vendor_id, room_number).
  - `room_assignments(id, invite_id, room_id→hotel_rooms, household, guest_name, extra_bed bool, created_by)` unique (invite_id, household, guest_name).
- Guest read: security-definer `my_room()` returning own household's hotel/room/dates (authenticated only).
- Capacity check in a validation trigger (warn in UI, block beyond max + extra bed).
- New `src/components/host-rooms.tsx` mounted as a tab in the logistics area; changes in `family.$household.tsx` and `guest-travel.tsx`.
- CSV export client-side.
