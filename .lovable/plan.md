# Sizes, size guide and a better Measurements tab

## What guests will see

### 1. On each look (Outfits page)
- A **Size guide** button that opens a panel with three tabs, like Pernia:
  - **Size chart**: the chart for the guest's gender (men or women), with a **cm / inches** switch.
  - **How to measure**: a simple drawing of a body with numbered points and one line of instructions for each (bust/chest, waist, hip, shoulder, sleeve, length, inseam, neck).
  - **Tips**: measure over light clothing, keep the tape snug but not tight, ask someone to help.
- A **size choice** that lists only the sizes the look comes in (sold-out sizes are greyed out), plus **Made to measure**.
- Choosing **Made to measure** sends the guest to the Measurements tab for that person.

### 2. Measurements tab (guest page), reworked
- One card for each family member. Each card shows **Done** or **Still to fill**.
- **Different form for men and women**, based on the member's gender:
  - Women: height, bust, under-bust, waist, hip, shoulder, sleeve length, armhole, blouse length, skirt length.
  - Men: height, chest, neck, waist, hip, shoulder, sleeve length, kurta length, trouser length, inseam.
  - Boys and girls get the same form as men or women, with a note that a parent should take the measurements.
- A **cm / inches** switch. Numbers already saved convert when you switch.
- Each box has a small **"How?"** link that opens the drawing for that measurement.
- **"I know my usual size"**: guests can just pick a size from the chart (for example M) instead of measuring.
- A clear summary at the top, e.g. "2 of 4 family members done".
- Existing saved measurements stay as they are. Women's "Bust / chest" fills "Bust", and men's fills "Chest".

### 3. Host side
- Host measurement screens, the tailor download and the family page show the new fields, the chosen size and "Made to measure".
- The **Clear** button keeps working.

## Charts used
- One women's chart (XS–6XL: UK size, bust, waist, hip) and one men's chart (XS–XXL: chest, waist, neck, hip), copied from Pernia, in cm and inches.
- Kora looks use the same men's chart until Kora's own chart is checked.
- Boys and girls have no chart for now. They only see "Made to measure".

## Technical details
- Migration: add nullable columns to `measurements` (under_bust, armhole, neck, chest, size_choice, made_to_measure, gender_form) and to `reservations` (`size_choice`). All columns are additive, with no grant changes because measurements keep their current access.
- Sizes for each look are saved in `outfits` as a new nullable jsonb `sizes` column (`[{label, in_stock}]`), filled in by the Pernia and Kora imports.
- New `src/lib/size-charts.ts` holds the static charts and how-to text. New `size-guide-dialog.tsx` and `measure-diagram.tsx` show them, using an inline drawing.
- `guest.measurements.tsx` is rewritten with a separate set of fields for each gender, plus member cards. It works on phones (one column) and on larger screens.
