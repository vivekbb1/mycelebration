# Workmen lists, tailor comments, private guest messages, and measurement report

## 1. Measurement records by invite code (read-only, nothing changed)

| Person | Invite code | Records | Status |
|---|---|---|---|
| David Mullaney | DAVID-WX9APCEM | 1 (no name saved) | No conflict |
| Dennis Ruf | DENNIS-VFN9Z87S | 1 (no name saved) | No conflict |
| Federico Michelini | FEDERICO-B5CB4137 | 2 (one unnamed, one named) | **Values differ** |
| Grant Fleming | GRANT-AJGZWMBE | 1 (no name saved) | No conflict |
| Joanne Ruf | JOANNE-C4BVNAEN | 1 (no name saved) | No conflict |
| Rachel Maria Clara Ruf | RACHEL-JGZHHAL8 | 1 (no name saved) | No conflict |
| Robyn Ruf | ROBYN-5R9KBMKB | 1 (no name saved) | No conflict |
| Roger David | ROGER-BC8VVYA8 | 1 (only usual size L) | No conflict |
| Tobias Siegenthaler | TOBIAS-W2HXQ9J5 | 1 (no name saved) | No conflict |

Federico's two records (cm). Both were saved on 19 Oct:

| Measurement | Record A (unnamed) | Record B (named) |
|---|---|---|
| Hip | 98 | 100 |
| Waist | 80 | 84 |
| Shoulder | 46 | 47 |
| Armhole | 30 | 32 |
| Inseam | 82 | 75 |
| Notes | "Overall not to slim fit especially for the trousers" | none |

Both records have the same height (183), chest (93), neck (39), sleeve (61), top length (98), bottom length (100) and usual size (M).

The records stay separate, as you asked. Nothing gets merged or overwritten until you tell me which of Federico's values are correct. Outfit selections are not touched.

## 2. Workmen under each tailor

- Each tailor gets a list of workmen with a name and an optional mobile number. You can add, edit or remove them from the alteration window, under the chosen tailor. They can also be managed from the tailor list.
- "Worked on by" becomes a dropdown with the chosen tailor's workmen. It also has "Add new workman…" so you can add one on the spot.
- Outfits that already have a typed-in workman name keep that name. It shows as the current choice until you pick someone from the list.
- The Alterations list shows "By [workman]" and can be filtered by workman.

## 3. Tailor's adjustment comments

- Each outfit's alteration window gets an "Adjustments needed" comment box. It is for the tailor's overall notes, like "shorten sleeves 2 cm, let out the waist". It sits beside the existing per-photo notes and fitting notes.
- Each tailor also gets a general comments field for standing notes that apply to all their work. Examples are turnaround time or how they like measurements given.
- Adjustment comments show in the Alterations list so they can be scanned without opening each one.

## 4. "Talk to the hosts" stays private to each family

- What was checked: the database rules already stop guests from reading other families' messages. But the guest message screen asks for every message without picking one family. When a host opens the guest area, they can read every message, so every family's messages appear there.
- Fix: the guest area only shows the messages for the signed-in person's own family, with the hosts' replies. That holds even for a host previewing it as a guest.
- The hosts' own Messages screen keeps showing all families, grouped by family, as now.

## Technical details

- New table `tailor_workmen` (invite_id, vendor_id, name, phone, active), with the same host-only access rules as the alteration records.
- `wardrobe_alterations`: add `workman_id` (an optional link to `tailor_workmen`) and `adjustments` (text). The existing `workman` text column stays as a fallback for old entries.
- `vendors`: add `tailor_notes` (text).
- The guest-messages query gets filtered by `household` and `invite_id` from the signed-in guest's own invite code.
- Add the new items to roadmap.md.
