# Sizes and measurements while choosing a look

## What guests will see
1. **Size on the outfit:** when a guest chooses a look, they pick from the sizes that look comes in (taken from the shop, e.g. XS to XXL), plus "Made to measure". Looks without shop sizes fall back to the standard list.
2. **Size guide link:** a "Size guide" button next to the sizes shows the chart for men or women (or boys and girls), based on the guest's gender.
3. **Made to measure:** picking it opens the measurement form right there. Ready sizes need no measurements.
4. **Separate forms for men and women:**
   - Women: bust, under-bust, waist, hip, shoulder, sleeve length, armhole, blouse length, lehenga/skirt length, height.
   - Men: chest, neck, shoulder, sleeve length, waist, seat/hip, kurta/sherwani length, trouser length, inseam, height.
   - The Measurements page uses the same form for each member, by gender.
5. Summary keeps the chosen size. Hosts see the size, and the measurements when "Made to measure" was picked.

## Step 1: check whether one chart fits all
Before building the size guide, I'll compare the size charts on several Pernia men's and women's looks (and Kora's) to see if each shop uses one chart per gender.
- **Same chart:** we save one chart per shop per gender and show it everywhere.
- **Different charts:** we save each look's own chart when it's imported.
I'll tell you what I find before going further.

## Technical details
- Pernia/Kora import: read the size options (and the chart, depending on Step 1) from product data; save to new `outfits.sizes` (jsonb) and `outfits.size_chart` (jsonb), or a `boutique_size_charts` table (boutique_id, gender, chart) when the chart is shared.
- `measurements`: add nullable columns (under_bust, armhole, chest, neck, seat, kurta_length, trouser_length) and `profile` text ('women' | 'men'); existing rows stay valid.
- `reservations.build_size` set at reserve time; "Made to measure" checks for a measurement row and prompts if missing.
- Edits: guest.outfits.tsx (size picker + guide dialog + inline form), guest.measurements.tsx (gender form), shared measurement-fields component, pernia.functions.ts and kora.functions.ts (sizes), host order/measurement views.
- Live feed looks: sizes are read when the look is opened, if the shop offers them.
