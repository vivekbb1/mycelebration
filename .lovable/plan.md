# New wording for the welcome page

Rewrite the front page so it speaks to wedding hosts looking at the portal, with guest sign-in kept in the corner for people who already have a code. Tone: warm and celebratory, with an elegant, understated finish. No couple names, no prices, no mention of gifts or who pays.

## What changes on the page

The page keeps its shape — small line, headline, paragraph, two buttons, four steps, a closing section, footer — and every line gets new text.

Draft copy:

- Site name: Celebration
- Small line: For the family hosting
- Headline: One place for the whole celebration.
- Paragraph: Invite your guests, see who is coming to each event, set aside what they will wear, collect measurements, and arrange their cars and rooms. Everything in one calm place, from the first invitation to the last goodbye.
- Main button: Start your celebration
- Second button: Guest with a code
- Note under the buttons: Guests sign in with the code you send them. Hosts sign in with their own invitation from us.
- Steps title: How it works
- Step 1: Build your guest list — Add families, tag them however you think about them, and choose which events each one is invited to.
- Step 2: Invite and track replies — Send each family their own code and watch the replies land, event by event, with head counts you can rely on.
- Step 3: Set aside what they wear — Fill a wardrobe for each event, let guests choose their look, and collect the measurements a tailor needs.
- Step 4: Look after the arrivals — Flights, cars, drivers, hotels and rooms, all against the right family, with the details sent straight to them.
- Closing small line: Quietly organised
- Closing title: Your guests see only what concerns them.
- Closing text: Each family opens their own page: the events they are invited to, what they said yes to, the look set aside for them, and how they are getting there. Nothing else.
- Closing button: See a guest's view
- Footer: A private portal for weddings and the families who host them.

Guest-facing wording (the invitation, replies, outfits, measurements and summary pages) is left as it is in this pass.

## Where you edit it afterwards

All of these stay editable on the Platform page under "Welcome page & portal wording", so you can change any line without asking me.

## Technical notes

- Update the 22 `landing.*` rows in `site_content` (page_name "Welcome page"): set both `value` and `default_value` to the new copy, so the Reset button restores the new wording rather than the old.
- Update the matching fallback strings in `src/routes/index.tsx` (the second argument to each `t("landing.…")` call) so the page reads the same before the content rows load.
- Leave the 6 "Site-wide" menu rows and all Invitation/RSVP rows untouched.
- Review the second button's target: it should land on guest sign-in, and the main button on host sign-up/sign-in; adjust the links in `src/routes/index.tsx` if they currently point elsewhere.
- Refresh the welcome page head() title and description to match the new host-facing wording.
