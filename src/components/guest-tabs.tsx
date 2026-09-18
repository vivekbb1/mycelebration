import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Mail, Ruler, Sparkles } from "lucide-react";

import { useSiteContent } from "@/lib/site-content";

const GUEST_PATHS = ["/invitation", "/event", "/lookbook", "/measurements"] as const;

/** The four things a guest ever does, as tabs. */
export function GuestTabs() {
  const { t } = useSiteContent();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!GUEST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const tabs = [
    { to: "/invitation", label: t("nav.tab_invite", "Invite"), icon: Mail },
    { to: "/event", label: t("nav.tab_rsvp", "RSVP"), icon: CalendarCheck },
    { to: "/lookbook", label: t("nav.tab_outfit", "Outfit"), icon: Sparkles },
    { to: "/measurements", label: t("nav.tab_measurement", "Measurement"), icon: Ruler },
  ] as const;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm">
        {tabs.map((tab) => {
          const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
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
