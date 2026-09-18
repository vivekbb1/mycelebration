import { createFileRoute, Link } from "@tanstack/react-router";
import { Ruler, Sparkles, ShieldCheck, HandHeart } from "lucide-react";

import heroAttire from "@/assets/hero-attire.jpg";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/lib/site-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Wedding Wardrobe — Festive Attire for Our Guests" },
      {
        name: "description",
        content:
          "Our gift to you: pick a festive Indian outfit for each wedding function, send your measurements, and we'll take care of the rest.",
      },
      { property: "og:title", content: "The Wedding Wardrobe — Festive Attire for Our Guests" },
      {
        property: "og:description",
        content:
          "A private guest wardrobe: reserve a curated Indian outfit per function and share your measurements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useSiteContent();

  const steps = [
    {
      icon: Sparkles,
      title: t("landing.step1_title", "Browse the lookbook"),
      body: t(
        "landing.step1_body",
        "Curated lehengas, sarees, sherwanis and indo-western looks, grouped by function and hand-picked from designer boutiques.",
      ),
    },
    {
      icon: HandHeart,
      title: t("landing.step2_title", "Claim your look"),
      body: t(
        "landing.step2_body",
        "Each outfit can be claimed by one guest only. Once it's yours, it disappears from everyone else's list — no accidental twinning.",
      ),
    },
    {
      icon: Ruler,
      title: t("landing.step3_title", "Send measurements"),
      body: t(
        "landing.step3_body",
        "A guided form walks you through every measurement a tailor needs, in centimetres or inches, with tips for each one.",
      ),
    },
    {
      icon: ShieldCheck,
      title: t("landing.step4_title", "We handle the rest"),
      body: t(
        "landing.step4_body",
        "Ordering, tailoring and delivery are on us. The outfit is our gift — you just have to show up and dance.",
      ),
    },
  ];

  return (
    <div className="bg-zari min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="font-display text-lg tracking-wide">
          {t("landing.brand", "The Wedding Wardrobe")}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">{t("landing.signin", "Guest sign in")}</Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-eyebrow">{t("landing.eyebrow", "A gift from the family")}</p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl">
            {t("landing.headline", "Festive Indian attire, chosen for you before you land.")}
          </h1>
          <p className="mt-5 max-w-xl text-base whitespace-pre-line text-muted-foreground sm:text-lg">
            {t(
              "landing.body",
              "We know a lehenga fitting isn't easy to arrange from abroad. So we've curated a wardrobe for every function of the wedding. Reserve the look you love, send your measurements, and it will be waiting for you — tailored, pressed and paid for.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">{t("landing.cta_primary", "Open your invitation")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signin" }}>
                {t("landing.cta_secondary", "I already registered")}
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t(
              "landing.code_note",
              "You'll need the invitation code we sent you on WhatsApp or email.",
            )}
          </p>
        </div>

        <div className="panel overflow-hidden">
          <img
            src={heroAttire}
            alt="Emerald and gold lehenga, marigold silk saree and ivory sherwani laid out on a midnight blue backdrop"
            width={1600}
            height={1104}
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <div className="gold-rule mx-auto max-w-6xl" />

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-3xl sm:text-4xl">{t("landing.how_title", "How it works")}</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {steps.map((step) => (
            <div key={step.title} className="panel p-4 sm:p-6">
              <step.icon className="size-5 text-primary" />
              <h3 className="mt-4 text-xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 text-center">
        <p className="text-eyebrow">{t("landing.unique_eyebrow", "One guest, one look")}</p>
        <h2 className="mt-4 text-3xl sm:text-4xl">
          {t("landing.unique_title", "No two guests in the same outfit.")}
        </h2>
        <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground sm:text-base">
          {t(
            "landing.unique_body",
            "Every piece in the lookbook is reserved the moment a guest claims it, so the wardrobe you see is always the wardrobe that's still available. Reserve early for the best choice.",
          )}
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link to="/auth">{t("landing.unique_cta", "Choose your outfits")}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 px-4 py-8 text-center text-xs whitespace-pre-line text-muted-foreground">
        {t(
          "landing.footer",
          "A private portal for our wedding guests. Questions? Message the family group.",
        )}
      </footer>
    </div>
  );
}
