// Shared, client-safe delivery plan for the wedding wardrobe.
// Edit these details once and every guest page updates.

export const TAILOR = {
  name: "Shahi Darzi Atelier",
  contact: "Rehan Qureshi",
  whatsapp: "+91 98290 11223",
  email: "atelier@shahidarzi.example",
  address: "Shop 14, Gopal Bari, Ajmer Road, Jaipur, Rajasthan 302006, India",
};

export const MILESTONES = [
  {
    date: "20 December 2026",
    title: "Measurements due",
    body: "Submit your measurements in the portal. That is all we need from you — no forms, no calls with the tailor.",
  },
  {
    date: "5 January 2027",
    title: "Orders placed",
    body: "We order every reserved look from the designer or boutique and send your measurements to the atelier in Jaipur.",
  },
  {
    date: "25 January 2027",
    title: "Tailoring & first fit",
    body: "Blouses, kurtas and hems are stitched to your measurements. We check each piece against your notes.",
  },
  {
    date: "8 February 2027",
    title: "Outfits reach Jaipur",
    body: "Everything is pressed, bagged and labelled with your name and function.",
  },
  {
    date: "10 February 2027, 2–8 pm",
    title: "Pickup at the hotel",
    body: "Collect from the wardrobe suite at Devi Ratn (ask the concierge for the Bhatia wedding wardrobe). A tailor is on site for last-minute nips and tucks.",
  },
  {
    date: "11–13 February 2027",
    title: "Wear it and dance",
    body: "An on-call tailor is at the venue during every function for emergency fixes. Outfits are yours to keep.",
  },
] as const;

export const PICKUP_WINDOWS = [
  {
    label: "Main pickup",
    when: "Tue 10 Feb 2027, 2:00–8:00 pm",
    where: "Wardrobe suite, Devi Ratn, Jaipur–Kukas Road, Jaipur",
  },
  {
    label: "Late arrivals",
    when: "Wed 11 Feb 2027, 9:00–11:30 am",
    where: "Same suite, before the mehndi begins",
  },
  {
    label: "Can't make either?",
    when: "Tell us by 1 Feb 2027",
    where: "We'll courier the outfit to your hotel room or home address",
  },
] as const;
