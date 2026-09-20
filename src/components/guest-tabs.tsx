import { Link, useRouterState } from "@tanstack/react-router";
import { BadgeCheck, CalendarCheck, LayoutGrid, Mail, Ruler, Shirt } from "lucide-react";

import { useSiteContent } from "@/lib/site-content";
import { useNeedsWardrobe } from "@/lib/wardrobe";

const GUEST_PATHS = ["/invitation", "/portal", "/schedule", "/outfits", "/confirm", "/measurements", "/plan", "/pay"] as const;

/** The four things a guest ever does, as quiet underlined tabs in the header. */
export function GuestTabs() {
  const { t } = useSiteContent();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { needsWardrobe } = useNeedsWardrobe();

  if (!GUEST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const tabs = [
    { to: "/invitation", label: t("nav.tab_invite", "Invite"), icon: Mail },
    { to: "/portal", label: t("nav.tab_portal", "Portal"), icon: LayoutGrid },
    { to: "/schedule", label: t("nav.tab_rsvp", "Schedule"), icon: CalendarCheck },
    { to: "/outfits", label: t("nav.tab_outfit", "Outfit"), icon: Shirt },
    { to: "/measurements", label: t("nav.tab_measurement", "Measurement"), icon: Ruler },
    { to: "/confirm", label: t("nav.tab_confirm", "Summary"), icon: BadgeCheck },
  ].filter(
    // RSVP-only families never see the wardrobe steps.
    (tab) =>
      needsWardrobe ||
      (tab.to !== "/outfits" && tab.to !== "/measurements" && tab.to !== "/confirm"),
  );

  return (
    <nav className="flex items-center gap-1 sm:gap-5">
      {tabs.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-label={tab.label}
            className={`relative flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-px after:rounded-full after:transition-colors sm:px-0 ${
              active
                ? "text-primary after:bg-primary"
                : "text-muted-foreground after:bg-transparent hover:text-foreground"
            }`}
          >
            <tab.icon className="size-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
