import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CalendarCheck, LogOut, Mail, Ruler, Shirt, User, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsAnyHost } from "@/lib/host-role";
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

const GUEST_PATHS = ["/guest/invite", "/guest/schedule", "/guest/outfits", "/guest/summary", "/guest/measurements", "/plan", "/pay"] as const;

/** The four things a guest ever does, as quiet underlined tabs in the header. */
export function GuestTabs() {
  const { t } = useSiteContent();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { needsWardrobe } = useNeedsWardrobe();

  if (!GUEST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const tabs = [
    { to: "/guest/invite", label: t("nav.tab_invite", "Invite"), icon: Mail },
    { to: "/guest/schedule", label: t("nav.tab_rsvp", "Schedule"), icon: CalendarCheck },
    { to: "/guest/outfits", label: t("nav.tab_outfit", "Outfits"), icon: Shirt },
    { to: "/guest/measurements", label: t("nav.tab_measurement", "Measurements"), icon: Ruler },
    { to: "/guest/summary", label: t("nav.tab_confirm", "Summary"), icon: BadgeCheck },
  ].filter(
    // RSVP-only families never see the wardrobe steps.
    (tab) =>
      needsWardrobe ||
      (tab.to !== "/guest/outfits" && tab.to !== "/guest/measurements" && tab.to !== "/guest/summary"),
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
            className={headerTabClass(active)}
          >
            <tab.icon className="size-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Guest profile menu — mirrors the host one: celebration picker, then an account menu. */
export function GuestProfileMenu() {
  const navigate = useNavigate();

  const { data: isAdmin } = useIsAnyHost();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex items-center gap-2">
      <GuestEventPicker />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Your account">
            <User className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Your account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/pay">
              <Wallet className="mr-2 size-4" /> Who owes what
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/host">
                <Shirt className="mr-2 size-4" /> Host area
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="mr-2 size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
