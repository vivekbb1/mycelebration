# Travel needs per family, with required or optional sections

Hosts choose what each family needs, and whether the questions are required or optional. Guests then see only the questions that apply to them.

## What hosts see

**Setup → Celebration** sets the **default travel need** for the whole celebration. Every family starts with it.

**Guests → Families**: each family can use the default or override it with a new **Travel** choice, next to the existing "Outfit from us / RSVP only" choice:

- **No travel help**: the family doesn't see the Travel or Passport sections.
- **Stay only**: for local guests who need a hotel room but no airport pickup. They're asked for check-in and check-out **dates and times**, plus passport details.
- **Stay + pickup & drop-off**: for guests flying in. They're asked for flights in and out, check-in and check-out dates and times, and passport details.

**How the setting passes down:** celebration default → family → each person in that family. Every family member's access to the Travel and Passport sections, and which questions they see, follows their family's setting. Moving a person to another family gives them that family's setting. Owners and co-hosts can change the default and any family's setting. Guests can't change their own.

The same choice can be applied to many families at once from the existing multi-select, and there's a filter so hosts can list, say, all "Stay + pickup" families.

**Managing a family's travel details:** each family has a **Travel details** panel where hosts can:
- Change the family's travel need, or reset it to the celebration default.
- See and edit what the family entered: flights, check-in and check-out dates and times, how many people, notes, and passport details.
- Remove the family's travel details, their passport details, or both. A confirmation appears before anything is removed, and uploaded passport pages are deleted too.

**Setup → Celebration**: two new settings:
- Travel details: **Required** or **Optional**
- Passport details: **Required** or **Optional**

These only affect families who need a stay. Families marked "No travel help" are never asked.

## What guests see

- **No travel help**: neither section appears.
- **Stay only**: a "Your stay" section asking for check-in and check-out dates and times. There are no flight questions. It's followed by the Passport section.
- **Stay + pickup & drop-off**: the current Travel section (flights, times, how many are travelling), plus check-in and check-out dates and times, then Passports.
- **Optional** sections stay folded away and are marked "(optional)", as they are now.
- **Required** sections open by default and are marked "Needed". Until they're filled in, the guest Summary shows them as still to do, and the host Guest tracker shows the family as missing travel or passport details.

## Where it shows for hosts

- The Travel and Flights screens show each family's travel need, so pickup lists include only "Stay + pickup" families.
- The Overview and Guest tracker count missing required travel and passport details.

## Technical details

- Migration (additive):
  - `invites.default_travel_need text not null default 'none'` (`none` | `stay` | `stay_transfer`).
  - `families.travel_need text` (nullable; null means use the celebration default), validated by a trigger.
  - `invites.travel_required boolean default false` and `invites.passport_required boolean default false`.
  - `travel_plans.checkin_date date`, `checkin_time text`, `checkout_date date`, `checkout_time text` (nullable).
- Guests with no family use the celebration default. Only hosts of that celebration (`is_celebration_host`) can change a family's setting or edit or remove its travel and passport rows. Existing policies are checked for host update and delete, and added where missing.
- A security-definer function `my_travel_settings()` returns the family's need and the celebration's required flags to the signed-in guest, the same way `my_family_needs_wardrobe()` works. It's granted to `authenticated` only.
- Guest side: `guest-travel.tsx` and `guest-passports.tsx` read the settings, hide or show sections and fields, and set whether a section starts open. Summary and the guest tracker add "missing required" checks.
- Host side: the choice, bulk action and Travel details panel go in `host-families.tsx`, the default and Required/Optional settings in `host-events.tsx` (Celebration tab), and the filter/labels in the travel, flights and tracker screens. Everything stays scoped to the celebration being worked on.
- Existing families use the celebration default, which starts as "No travel help", until a host changes it.
- roadmap.md gets this task when building starts.
