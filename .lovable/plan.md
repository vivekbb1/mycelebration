# Outfit picks by family (Wardrobe → Selection)

## What changes
Replace the "Outfit picks per guest" table with "Outfit picks by family". The reminder panel and Measurements panel above and below it stay as they are.

Each family gets a card:
- **Header:** the family name and a score "x / y outfits chosen". For example, 2 members × 2 events where you give the outfits = 4 to choose. The score is green with "All set" once x = y.
- **Members:** one row per member, with their name, men's/women's/boy/girl and a measurements badge ("Measurements in" or "No measurements yet").
- **For each event:** a small photo of the reserved outfit, its title, and "Reserved" or "Confirmed". If nothing is chosen yet, it says "Not chosen".

Sorting and filtering:
- Families that still have outfits to choose come first. A small filter switches between All, Still choosing and Complete.
- On mobile, the cards stack, and each member's events go one under the other.

## Counting rules (same as the guest Invite page)
- Only events with outfit selection switched on count. Own-outfit events are left out.
- Only events that family is invited to count.
- Boys and girls only count for an event that has looks for them, or if they've already reserved one.
- Looks reserved by one member for another, for example Bharat for Jyoti, count for the person who'll wear the look.

## Technical details
- Edit `src/components/host-picks.tsx`: group the invited guests (invite_codes in the selected celebration) by household, and use `household_event_invites` to decide which events each family is invited to.
- Also load reservations with `outfits(title, image_url, images, gender)` and their build fields so the "Confirmed" state shows. Load outfit genders for each event to apply the kids rule.
- Match measurements by `guest_id` (the member's signed-in account) or by guest_name within the household.
- Show photos through the existing smaller cached copies.
- Display only. No changes to the database.
