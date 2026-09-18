# Wedding Wardrobe — roadmap

Done
- [x] Guest portal: invite-code unlock, reserve a look (one guest per outfit), guided measurements, "my wardrobe" view
- [x] Event page: host-managed functions (date, timing, venue, address, dress code, note, RSVP deadline) + RSVP, linked from the lookbook
- [x] Host dashboard: reserved looks, measurements in, not registered, no RSVP; add/edit/delete outfits
- [x] Host guest list: invite by name/email, per-guest progress, copy or email the invitation code
- [x] Host "Functions" tab and "Delivery plan" tab — nothing hardcoded
- [x] Reservation confirmation email + per-guest invitation email
- [x] All sample data cleared
- [x] Multiple hosts: "Hosts" tab to share host access with other registered people, remove a host (never the last one or yourself)
- [x] View as guest: read-only guest portal per guest (reserved looks, measurements, RSVP), opened from the guest list

New tasks (this turn)
- [ ] Sender domain: check email domain status and set it up so invitation + confirmation emails reach real guests, then send a test invite
- [ ] Real Pernia's outfits in the Outfits tab — needs the host's actual photo/product links (host access can only be claimed by the host themselves)
- [x] Tailor / boutique portal: a stylist at each designer or boutique signs in and sees only their own orders (reserved outfits + the guest's measurements, no other boutique's looks)

Open, for the host to do
- [ ] Claim host access at `/host` (first sign-up wins), then add the real functions, delivery plan and looks
- [ ] Provide a domain you own for sending email

## Done (latest)
- Per-family function access: host "Invited to" tab ticks which functions each family may see; guests only see those functions and their outfits. Functions from the printed invitation (Mehendi, Bollywood Night, Acha Sathiyaro, Wedding, Reception) loaded with dates, venues and attire.
- Couples/families: each person gets their own invitation code but shares a family name; men/women wardrobe per guest, guests can pick their own if unset; lookbook shows only matching looks with a switch; importer has a wardrobe override; guest list and picks group families together.
- Host "By boutique" tab: looks grouped by atelier with reserving guest + measurement status.
- Bulk invite guests (paste name/email per line) + "Email everyone pending" with clipboard fallback.
- Bulk outfit edit: multi-select, set function/boutique, remove several looks.
- Invitation email falls back to the host's own mail app until a sending domain is verified.

## Payments (waiting on the user's go-ahead)
- [ ] Card payments via Stripe (built-in, Lovable-managed). Not enabled yet — user said "not yet".
- [ ] Hosts pay for a package + add-ons: subscription and one-off (per-event) charges.
- [ ] Hosts can also collect payments from their own guests for paid events (host-as-seller payouts).
- Note: Paddle ruled out (physical attire in the offering); seller country AE, so Stripe with tax calculation and collection only (automatic_tax), not managed_payments.

- Event fees: fee rules (flat / per head / per function) live in event_fees; manual payments in fee_payments. Card checkout still pending Stripe.
