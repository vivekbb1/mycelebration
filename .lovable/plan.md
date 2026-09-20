# A web address for every celebration

Each celebration gets its own public landing page at `yourdomain.com/<name>` — for example
`celebrationio.lovable.app/kush-khyati`. Hosts can share that link with guests before anyone signs in.

## What hosts see

- On **Setup → Celebration** there's a new **Web address** box: a short name (letters, numbers, dashes)
  with a live preview of the full link and a Copy button.
- The name is suggested automatically from the celebration's name and can be edited.
- If the name is already used by another celebration, or clashes with an existing page name
  (sign in, host, platform, and the guest pages), it's refused with a clear message.

## What visitors see

A calm public page for that celebration only:

- The celebration name, with the cover logo if one is set.
- The list of events with date, time, venue and dress code.
- A short welcome line the host can edit.
- A "I have an invitation code" button leading to the sign-in page with the code box ready.

Nothing private appears — no guest names, no charges, no wardrobe.

## Technical notes

- Migration: add `invites.slug text` (nullable, unique index on `lower(slug)`) and
  `invites.public_intro text`. Add a `SECURITY DEFINER` function
  `public.celebration_by_slug(_slug text)` returning the celebration's name, intro, cover logo and its
  events (name, date, start time, venue, dress code) so anonymous visitors read only those fields;
  `GRANT EXECUTE` to `anon` and `authenticated`. No new anon table policies.
- New route `src/routes/$celebration.tsx` (a dynamic top-level segment; static routes such as `/auth`,
  `/host`, `/invite` still win). Loader calls the function via the publishable client; unknown slug
  throws `notFound()` and renders a gentle "We couldn't find that celebration" page. Route `head()`
  sets title/description/og from the celebration name.
- A reserved-word list shared by the host editor and the route guard prevents slugs that would shadow
  existing pages.
- Host editor lives in `src/components/host-events.tsx` (Celebration tab) — slug input saving on blur,
  plus the intro textarea and copy-link button.
