import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Ruler, Sparkles, ShieldCheck, HandHeart } from "lucide-react";

import heroAttire from "@/assets/hero-attire.jpg";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/lib/site-content";
import { slugForThisDomain } from "@/lib/domain-celebration.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const slug = await slugForThisDomain();
    if (slug) throw redirect({ to: "/$celebration", params: { celebration: slug } });
  },
  head: () => ({
    meta: [
      { title: "My Celebration — One Place for the Whole Wedding" },
      {
        name: "description",
        content:
          "Invite your guests, track replies event by event, set aside what they wear, collect measurements and arrange their cars and rooms — all in one place.",
      },
      { property: "og:title", content: "My Celebration — One Place for the Whole Wedding" },
      {
        property: "og:description",
        content:
          "A private portal for weddings and the families who host them: guest lists, replies, wardrobe, measurements and arrivals.",
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
      title: t("landing.step1_title", "Build your guest list"),
      body: t(
        "landing.step1_body",
        "Add families, tag them however you think about them, and choose which events each one is invited to.",
      ),
    },
    {
      icon: HandHeart,
      title: t("landing.step2_title", "Invite and track replies"),
      body: t(
        "landing.step2_body",
        "Send each family their own code and watch the replies land, event by event, with head counts you can rely on.",
      ),
    },
    {
      icon: Ruler,
      title: t("landing.step3_title", "Set aside what they wear"),
      body: t(
        "landing.step3_body",
        "Fill a wardrobe for each event, let guests choose their look, and collect the measurements a tailor needs.",
      ),
    },
    {
      icon: ShieldCheck,
      title: t("landing.step4_title", "Look after the arrivals"),
      body: t(
        "landing.step4_body",
        "Flights, cars, drivers, hotels and rooms, all against the right family, with the details sent straight to them.",
      ),
    },
  ];

  return (
    <div className="bg-zari min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="font-display text-lg tracking-wide">
          {t("landing.brand", "My Celebration")}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth" search={{ mode: "signin" }}>
            {t("landing.signin", "Sign in")}
          </Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-eyebrow">{t("landing.eyebrow", "For the family hosting")}</p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl">
            {t("landing.headline", "One place for the whole celebration.")}
          </h1>
          <p className="mt-5 max-w-xl text-base whitespace-pre-line text-muted-foreground sm:text-lg">
            {t(
              "landing.body",
              "Invite your guests, see who is coming to each event, set aside what they will wear, collect measurements, and arrange their cars and rooms. Everything in one calm place, from the first invitation to the last goodbye.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">{t("landing.cta_primary", "Start your celebration")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">{t("landing.cta_secondary", "Guest with a code")}</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t(
              "landing.code_note",
              "Guests sign in with the code you send them. Hosts sign in with their own invitation from us.",
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
        <p className="text-eyebrow">{t("landing.unique_eyebrow", "Quietly organised")}</p>
        <h2 className="mt-4 text-3xl sm:text-4xl">
          {t("landing.unique_title", "Your guests see only what concerns them.")}
        </h2>
        <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground sm:text-base">
          {t(
            "landing.unique_body",
            "Each family opens their own page: the events they are invited to, what they said yes to, the look set aside for them, and how they are getting there. Nothing else.",
          )}
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link to="/auth">{t("landing.unique_cta", "See a guest's view")}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 px-4 py-8 text-center text-xs whitespace-pre-line text-muted-foreground">
        {t(
          "landing.footer",
          "A private portal for weddings and the families who host them.",
        )}
      </footer>
    </div>
  );
}
