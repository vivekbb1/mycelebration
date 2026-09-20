import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CalendarCheck, LogOut, Mail, Ruler, Shirt, User, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GuestEventPicker } from "@/lib/guest-event";
import { headerTabClass } from "@/components/host-nav";
import { useSiteContent } from "@/lib/site-content";
import { useNeedsWardrobe } from "@/lib/wardrobe";

const GUEST_PATHS = ["/invite", "/schedule", "/outfits", "/summary", "/measurements", "/plan", "/pay"] as const;

/** The four things a guest ever does, as quiet underlined tabs in the header. */
export function GuestTabs() {
  const { t } = useSiteContent();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { needsWardrobe } = useNeedsWardrobe();

  if (!GUEST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const tabs = [
    { to: "/invite", label: t("nav.tab_invite", "Invite"), icon: Mail },
    { to: "/schedule", label: t("nav.tab_rsvp", "Schedule"), icon: CalendarCheck },
    { to: "/outfits", label: t("nav.tab_outfit", "Outfits"), icon: Shirt },
    { to: "/measurements", label: t("nav.tab_measurement", "Measurements"), icon: Ruler },
    { to: "/summary", label: t("nav.tab_confirm", "Summary"), icon: BadgeCheck },
  ].filter(
    // RSVP-only families never see the wardrobe steps.
    (tab) =>
      needsWardrobe ||
      (tab.to !== "/outfits" && tab.to !== "/measurements" && tab.to !== "/summary"),
  );

  return (
    <nav className="flex items-center gap-1 sm:gap-5">
      <GuestEventPicker />
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
