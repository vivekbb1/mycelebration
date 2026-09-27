# Make My Celebration a true multi-celebration platform

Today every host is a whole-app admin, so any host could read every celebration's guests, passports and measurements. This plan puts each celebration behind its own wall, following your brief in order. The app keeps running after every phase, and Kush & Khyati keeps working throughout. Card payments stay off.

## Starting point
- 1 celebration (Kush & Khyati), 2 hosts. One of them is also the platform operator.
- 45 tables and 5 file-storage rules. Almost all of them check "is any admin", not "is a host of this celebration".
- Several tables have no celebration link at all. They're tied to a household, a guest or an outfit instead: messages, travel, passports, measurements, attendance, stays, transport, reservations, favourites and communications. Logistics, email settings, branding and wording are single rows shared by the whole app.

## Phase 1: Hosts belong to a celebration (brief section 1)
- New celebration-hosts list (owner or host). The existing 2 hosts become owners of Kush & Khyati.
- Host invite codes carry their celebration. Claiming one adds you as a host of that celebration only, never as a whole-app admin.
- New checks: "is platform operator", "is host of this celebration", "my celebrations". "My events" is limited to celebrations you belong to.
- Hosts page: an owner can invite or remove co-hosts for their celebration and can't remove the last owner.
- Every screen that asks "is admin" (menu, host area, boutique portal, platform page, server actions such as email, WhatsApp, reminders and imports) switches to "host of this celebration" or "platform operator".
- The whole-app admin role stays on the 2 existing accounts during the move, then stops being handed out.

## Phase 2: Access rules on every table and file (brief section 2)
- Tables without a celebration link get one, filled in from their household, guest or outfit. Kush & Khyati's current rows all get Kush & Khyati.
- Every rule is rewritten with the same pattern:
  - The platform operator can see and change everything.
  - Hosts can see and change rows in their own celebrations only.
  - Guests see their own household, their events and their celebration only.
  - Boutiques see only their own outfits, orders and measurements.
- Closing the gaps your brief names:
  - Guests can no longer list celebrations.
  - Looks without an event still belong to a celebration.
  - Logistics are per celebration.
  - The leftover bits of the old unclaimed-code list are removed.
- Stored files (event pictures, passports, logos) get a celebration folder. Passport files can be opened only by that household and that celebration's hosts.
- Anything that can't be tied to a celebration shows nothing, rather than everything.
- A tenancy check page, for the platform operator only, creates two test celebrations and confirms that Host A gets zero of Host B's guests, passports and measurements.

## Phase 3: Settings per celebration (brief section 3)
- Email sender, branding and cover logo, and logistics become settings for each celebration.
- Wording is split in two. Homepage wording stays platform-wide and only the operator can edit it. Guest and host wording can be changed per celebration, falling back to the defaults.
- Web address lookup only matches domains the operator has attached.

## Phase 4: Packages per celebration (brief section 4)
- Package, add-on and upgrade requests belong to a celebration, not a person.
- Features are worked out for the celebration currently selected. Every paid table checks the same feature as its screen, like budgeting and vendors do already.
- The operator approves an upgrade for one celebration only. Invoice wording stays as it is, and card buttons stay off.

## Phase 5: Using more than one celebration (brief section 5)
- **Create a celebration:** you become its owner, get a unique short link and an empty guest list, and land in its host area.
- **Picker:** appears in the host area when you host more than one.
- **Host dashboard:** asks the database only for the selected celebration, instead of loading everyone and sorting on screen.
- **Guests:** a guest with codes for two celebrations only ever sees the one they've selected.

## Phase 6: Housekeeping (brief section 6)
- Keep the project's secret settings file out of the saved code history.
- Inbound email and WhatsApp messages are filed under the matching celebration. Only its hosts, or the operator, see ones that couldn't be matched.

## Not built
Card payments, payouts, tax, self-claiming host access, and history rewrites.

## Risks
- This is a large change that touches nearly every page. I'll check after each phase that the Kush & Khyati guest path still works: invite code, replies, claiming a look, measurements, confirmed looks staying locked, the boutique portal and emails.
- I'll deliver it over several turns, one phase at a time, starting with phases 1 and 2.

## Technical notes
- `celebration_hosts(invite_id, user_id, role)` with a unique pair. Helpers `is_celebration_host(uuid)` and `my_celebration_ids()` are security definer functions.
- `host_invites.invite_id`. `claim_invite` for HOST- codes inserts into `celebration_hosts`.
- Add a nullable `invite_id` with a backfill to: guest_messages, travel_plans, guest_passports, measurements, event_attendance, reservations, logistics, email_settings, branding, boutiques (through a join table), inbound_unmatched, email_delivery_events, and the outfit import tables. Columns are added, never dropped.
- Policies use the pattern `is_platform_admin() OR invite_id IN (select my_celebration_ids())`. Storage paths use a `<invite_id>/...` prefix.
- Server functions replace `has_role(admin)` with `is_celebration_host(inviteId)`.
