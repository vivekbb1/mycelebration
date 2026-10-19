# Bring back the missing outfit choices on the Selection tab

## What is happening
None of these choices were deleted. All 49 are still saved, and that's why they show in Manage. The Selection tab only credits a choice to a person when the name saved on the choice matches that person's full name on the guest list. For 7 families, the choice was saved under a first name only, or with the names in the wrong order, so it doesn't match:

| Saved as | Guest list name | Events |
|---|---|---|
| Alla | Alla Ferreiro | Wedding, Big Bollywood Night |
| Olena | Olena Stupin | Wedding, Big Bollywood Night |
| Anna | Anna Roques | Wedding, Big Bollywood Night |
| Roques Hugo | Hugo Roques | Wedding, Big Bollywood Night |
| Grant | Grant Fleming | Wedding, Big Bollywood Night |
| Dennis | Dennis Ruf | Wedding, Big Bollywood Night |
| Jordan | Jordan Grogor | Wedding, Big Bollywood Night |

That makes 14 choices in total.

## Steps
1. **Confirm with you first.** I'll check the table above with you before anything is saved.
2. **Correct the names on those 14 choices only.** I'll change just the wearer's name to the full guest-list name. The look, the size, the confirmation, any order and any payment stay exactly as they are. No other choices are touched, and the change is recorded in the new choice history.
3. **Stop it happening again.** Selection, Overview, the reminder list and the family page will also accept a first name, or a name written in reverse order, when it clearly belongs to exactly one person in that family. When a new look is chosen, the full guest-list name will be saved with it.
4. **Check the result.** Open Wardrobe → Selection and confirm that Alla, Olena, Anna, Hugo, Grant, Dennis and Jordan each show 2 looks, and that the family scores add up to the 49 choices.

## Technical details
- Change the data with a single UPDATE on `reservations.guest_name`, keyed by reservation id, for the 14 rows only. The `reservations_history` trigger records the old and new values.
- In `normalize`/matching in `src/lib/outfit-pick-progress.ts`, also accept a reversed full name, and accept a first-name-only match when it is unique within the family. Add tests for "Alla", "Roques Hugo", and an ambiguous first name that should not match.
- When a look is reserved, set `guest_name` to the invite_code's full `guest_name`.
