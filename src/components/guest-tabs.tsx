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

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });

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
