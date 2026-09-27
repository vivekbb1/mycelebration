# Give every host section its own web address

## What changes
Right now the host area sits on one address (`/host`) with only a small `?tab=` tag added, and the tabs inside a section (for example Guests → List, Tags, Assign, RSVP) don't change the address at all. After this change, the host area works the same way as the guest pages: each section and each tab inside it gets its own clean address that you can bookmark, share with another host, refresh, or go back to.

```text
/host                      -> Overview
/host/celebration
/host/events
/host/guests               -> opens on List
/host/guests/tags
/host/guests/assign
/host/guests/rsvp
/host/guests/broadcast
/host/guests/count
/host/guests/logistics
/host/guests/communication
/host/guests/tracker
/host/wardrobe             -> opens on Upload
/host/wardrobe/bulk-upload
/host/wardrobe/selection
/host/wardrobe/orders
/host/wardrobe/delivery
/host/setup                -> first unlocked Setup tab
/host/setup/<tab>          (hosts, fees, branding, wording, email, vendors, budget, boutiques ...)
```

- The top-bar tabs and the profile menu (Setup) link to these addresses and underline the one you're on.
- Clicking a tab inside a section updates the address as well, and the browser's back button steps back through tabs.
- Locked tabs keep their rules: opening the address of a tab a host doesn't have sends them to that section's first tab they can use.
- Old links keep working: `/host?tab=guests` and the rest redirect to the new addresses.
- The page's browser-tab title follows the section (for example "Guests · RSVP — My Celebration").

## Technical details
- Add a `src/routes/_authenticated/host.$section.tsx` route and a `host.$section.$sub.tsx` route (plus `host.index.tsx` for Overview). Turn `host.tsx` into a layout that renders `<Outlet />`. The existing page body moves into a shared `HostArea` component that takes `section` and `sub` from the route params.
- Swap each inner `<Tabs defaultValue=…>` for a controlled `value={sub}`, with `onValueChange` running `navigate({ to: "/host/$section/$sub", params })`.
- Keep a map of slug to tab value and feature gate. Unknown or locked slugs fall back to the first allowed tab through a `redirect` in `beforeLoad`, or a `navigate` on the client once features load.
- Update `HostTabs`, `HostProfileMenu`, `headerTabClass` active checks, and every `Link to="/host" search={{ tab }}` across the codebase (dashboard cards, family file back links, guest file, upgrade page). Old `?tab=` URLs on `/host` are handled by redirecting to the new path.
- No database changes.
