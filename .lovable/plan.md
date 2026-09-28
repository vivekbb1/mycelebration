# Families register themselves from event links

Hosts make as many sign-up links as they like, and each link covers the events you pick. A family that registers through a link joins those events straight away and gets a family code. There's no approval step: you can delete any registration you don't want.

## What hosts see

- **Setup → Celebration → Family sign-up links:** a list of links. For each one:
  - A label (for example "Bride's side – all events" or "Reception only").
  - Tick boxes for the events it covers. You can change these at any time.
  - A Copy link button. Links never expire: the same address keeps working and follows whatever events are ticked. An optional pause switch stops sign-ups for a while.
  - How many families have registered through it.
- **Families:** self-registered families show a "Registered via link: <label>" tag. There's a **Delete registration** button with a confirm step. It removes the family, its members, codes and replies from this celebration.
- After a family registers, you can still add or remove events for them, like any other family.

## What the family sees

1. The celebration page shows **"Register our family"** only when the visitor opened a valid link.
2. **Sign-up form:** family name, main contact's full name, email, mobile and gender. The contact then creates an account (email and password, or Google / Microsoft / Apple).
3. **Add members:** name and gender for each person, plus email and mobile if they want. Members can be added later.
4. **Done:** the family code with a Copy button, then straight on to their invitation. They see only the events that link covers.

**Members:** the main contact can fill in details for everyone. Any member can also sign in with the shared family code and handle their own details.

## How changing a link's events works

The events on a link apply when a family registers. Changing a link later only affects families who register after the change. Families already registered keep their events, and you can change those per family.

## Safety

- Each link carries a secret token. Without a valid, switched-on link, sign-up is refused.
- A family only ever joins the celebration and events its link belongs to.
- Sign-ups are limited per link each day to stop spam.

## Technical details

- Migration: new table `signup_links` (id, invite_id, label, token unique, event_ids uuid[], enabled bool, created_at), with GRANTs, RLS through `is_celebration_host(invite_id)`, plus `families.signup_link_id uuid` (nullable). `celebration_by_slug` or a new `signup_link_info(_token)` returns only the celebration name and link label when enabled.
- `registerFamily` (requireSupabaseAuth, service role inside):
  1. Checks the token and the rate limit.
  2. Inserts the family (family code via `makeFamilyCode`) and member `invite_codes`, and links the caller's profile (household, gender, phone).
  3. Inserts `household_event_invites` for the link's `event_ids`.
- `addFamilyMember` for the caller's own family only.
- `deleteFamilyRegistration` checks that the caller is a celebration host, then deletes the family and its `invite_codes`, event invites and attendance for that `invite_id`.
- New public route `/$celebration/register?t=<token>`. UI changes in `host-events.tsx` (the links list) and `host-families.tsx` (tag and delete).
