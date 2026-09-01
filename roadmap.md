# Wedding Wardrobe — roadmap

- [x] Seed sample data: event details (venue/time/RSVP), 12 sample outfits, sample guests/invites/reservations/measurements
- [x] Outfit photos in `public/outfits/`
- [x] Guest event page: dates, venue, RSVP — linked from lookbook
- [x] Guest "my reservation" view (chosen look + measurement status)
- [x] Host: edit + delete outfits
- [x] Host guest list page: invite by name, see who reserved what, who submitted measurements, who hasn't responded
- [x] Host dashboard summary (reserved / measured / silent)
- [x] Delivery plan page: pickup dates, sizes, how to send measurements to the tailor
- [x] Email confirmation on reservation — code in place, silently skipped until `RESEND_API_KEY` + `RESERVATION_EMAIL_FROM` are set
- [x] End-to-end walkthrough: registered with a code, reserved a look, submitted measurements, RSVP'd, verified host dashboard
- [x] Guest email confirmation turned off so invited guests are in immediately

Open, for the host to do:
- [ ] Claim host access at `/host` (first sign-up wins) and replace sample outfits/dates with the real ones
- [ ] Add an email provider key if you want automatic reservation confirmation emails
