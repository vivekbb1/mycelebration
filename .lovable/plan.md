# Link every outfit choice to the person's code, not their name

## What is happening
Nothing was deleted. All 49 outfit choices are still saved, which is why they show in Manage. Selection credits a choice to a person only when the name saved on the choice matches their full name. For 7 people, the saved name doesn't match, so their 14 choices are not shown in Selection:

| Saved as | Person (code) | Events |
|---|---|---|
| Alla | Alla Ferreiro (ALLA-GFNC2W28) | Wedding, Big Bollywood Night |
| Olena | Olena Stupin | Wedding, Big Bollywood Night |
| Anna | Anna Roques | Wedding, Big Bollywood Night |
| Roques Hugo | Hugo Roques | Wedding, Big Bollywood Night |
| Grant | Grant Fleming | Wedding, Big Bollywood Night |
| Dennis | Dennis Ruf | Wedding, Big Bollywood Night |
| Jordan | Jordan Grogor | Wedding, Big Bollywood Night |

## Steps
1. **Link choices to codes.** Every outfit choice, and every set of measurements, gets a link to the person's family-profile code. Once linked, renaming a person or a family no longer affects their choices.
2. **Link existing choices.** The 35 choices that already match a name are linked automatically. The 14 choices above are linked to the codes you confirmed: ALLA-GFNC2W28, OLENA-JPMEEX74, ANNA-PBVQNJFJ, ROQUES-SXAFBEKK, GRANT-AJGZWMBE, DENNIS-VFN9Z87S and JORDAN-M8VDAU6K. Looks, sizes, confirmations, orders and payments stay exactly as they are, and every change is recorded in the choice history.
3. **New choices use the code.** When a guest or host reserves a look for a family member, the code is saved with it. The name is kept only for display.
4. **Every screen reads the code first.** This covers Selection, Overview, Orders, nudge reminders, the family page and the guest Invite and Summary pages. It also covers travel batches, room assignments and passports, which are linked to codes wherever they name a person. Names are used to match only for old records that have no code yet.
5. **Check the result.** In Selection, each of the 7 people shows 2 looks, and the family scores add up to 49. Then I'll rename a test person and confirm their looks stay with them.

## Technical details
- Migration: add a nullable column `member_code_id uuid` that references `invite_codes(id)` with ON DELETE SET NULL. Add it to `reservations`, `measurements`, `room_assignments` and `guest_passports`, and add an array of traveller codes to `travel_plans`. Backfill only exact matches within the same household and celebration.
- The 14 rows are set to the confirmed codes, matched by code and reservation id, using `supabase--run_sql`. The `reservation_history` trigger records each change.
- Make `memberLook`/`memberMeasurements` in `src/lib/outfit-pick-progress.ts` match on `member_code_id === member.id` first. Fall back to name matching only when the code is null. Add tests for code matching surviving a rename, and for a code taking priority over a mismatched name.
- Reserve paths (`guest.outfits.tsx`, `feed.functions.ts`, the host proxy reserve) and the measurements form (`guest.measurements.tsx`) send the selected member's code id.
- Record the rule "member records link by invite_code id, not name" in AGENTS.md, and add the task to roadmap.md.
