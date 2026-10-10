# Hosts manage family members on the family page

For families whose registration didn't finish (like Federico and Massimo), hosts can add, edit and remove members from one place.

## What hosts get
On each family's page (Guests → tap a family), a new **Family members** panel:
- **List** of every member: name, men's/women's/boy/girl looks, email, mobile, signed in or not.
- **Add member**: name, looks, email and mobile are optional. The new member gets the family's events and can choose outfits right away.
- **Edit**: change name, looks, email or mobile.
- **Remove**: removes a member who hasn't signed in, after you confirm. Members who have signed in are removed under Guests → Registered, as they are today.
- A **"Registration not finished"** tag on families with only one member who joined through a sign-up link, so these are easy to spot.

## Rules that stay in place
- One email per family in a celebration. Adding an email already used by another family shows a clear message.
- Only hosts of this celebration can make these changes.
- If an added member's email matches a later sign-in, that person is linked to the family automatically.

## Technical details
- New component `host-family-members.tsx`, rendered in `family.$household.tsx`.
- Server functions in `family-signup.functions.ts` (`hostAddMember`, `hostUpdateMember`, `hostRemoveMember`) using `requireSupabaseAuth` and checking `is_celebration_host(invite_id)`. They insert `invite_codes` with the family's `family_id`, `household`, `invite_id` and code, copy `household_event_invites` from the family, and only delete unclaimed rows.
- Reuse the existing `guard_email_one_family` trigger and turn its error into a readable message.
- No database schema changes.
