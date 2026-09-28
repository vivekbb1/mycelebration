# Families register themselves from a link

Hosts share one private sign-up link. A family registers, adds its members and gets a family code. The host then approves the family and picks which events it's invited to.

## What hosts see

- **Setup → Celebration → Family sign-up link:** an on/off switch, a Copy link button and a "Make a new link" button. Making a new link stops the old one working.
- **Families → "Waiting for approval":** a new list of families who signed up through the link. For each one you see the main contact, email, mobile and members. You can:
  - **Approve**, then tick their events (none are ticked to start with).
  - **Decline**, which removes the family.
- Approved families work like families you add by hand: travel needs, notes, tags, rooms and so on.

## What the family sees

1. The celebration page gets a third button, **"Register our family"**. It only shows when the host's link is on and the visitor used the private link.
2. **Sign-up form:** family name, main contact's full name, email, mobile and gender (Man / Woman). The contact then creates an account (email and password, or Google / Microsoft / Apple).
3. **Add members:** name and gender for each person, plus email and mobile if they want. Members can be added or removed later.
4. **Done screen:** "Thank you — the hosts will confirm your invitation." It shows the family code with a Copy button.
5. **Until approved:** signing in shows the same waiting message. No events, outfits or details are visible.
6. **After approval:** the family sees only the events the host ticked.

**Members (a mix of both options):** the main contact can fill in details for everyone. Any member can also sign in on their own with the shared family code and handle their own details.

## Safety

- The link carries a secret token. Without it, the Register button doesn't show and sign-up is refused.
- Families that aren't approved can't see anything from the celebration.
- Sign-ups are limited per link each day to stop spam.
- A family only ever joins the celebration its link belongs to.

## Technical details

- Migration:
  - `invites.self_signup_enabled bool default false`
  - `invites.self_signup_token text` (unique)
  - `families.status text default 'approved'` (values: `pending` / `approved`), plus `families.self_registered bool default false`
  - `celebration_by_slug` also returns `signup_open` only when the token matches; the token itself is never exposed.
- Server functions:
  - `registerFamily` (requireSupabaseAuth): checks the token, applies the rate limit, then uses the service role to insert the pending family and the member `invite_codes` (family code via `makeFamilyCode`) and links the caller's profile (household, gender, phone).
  - `addFamilyMember` / `removeFamilyMember`: pending or own family only.
- Pending families get no `household_event_invites`, so `my_event_ids` returns nothing. `is_guest_of` / `is_my_household` also require `families.status = 'approved'`.
- Approving sets the status and inserts the chosen `household_event_invites`. The host can email the family through the existing invite email.
- New public route `/$celebration/register?t=<token>`. The celebration page shows the button when `?t=` is valid. `/guest/invite` shows the waiting state while the family is pending.
- Host UI: `host-events.tsx` (link settings) and `host-families.tsx` (the "Waiting for approval" list).
