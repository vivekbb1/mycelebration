import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Heart,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  User,
  Users,
} from "lucide-react";

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
import { useFeatures } from "@/lib/features";
import { EventPickerCompact, SelectedEventProvider } from "@/lib/selected-event";

/** Shared header tab styling for hosts and guests alike. */
export const headerTabClass = (active: boolean) =>
  `relative flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-px after:rounded-full after:transition-colors sm:px-0 ${
    active
      ? "text-primary after:bg-primary"
      : "text-muted-foreground after:bg-transparent hover:text-foreground"
  }`;

/** The host tabs that live in the top bar. */
export function HostTabs() {
  const { has } = useFeatures();
  const active = useRouterState({
    select: (s) => (s.location.search as { tab?: string })?.tab ?? "overview",
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHost = pathname === "/host";

  const tabs = [
    { value: "overview", label: "Overview", icon: LayoutDashboard, show: true },
    { value: "invitations", label: "Celebration", icon: Heart, show: true },
    { value: "functions", label: "Events", icon: CalendarDays, show: has("functions") },
    { value: "guests", label: "Guests", icon: Users, show: has("guest_list") },
    { value: "wardrobe", label: "Wardrobe", icon: Shirt, show: has("wardrobe_picker") },
  ].filter((t) => t.show);

  return (
    <nav className="flex items-center gap-1 sm:gap-5">
      {tabs.map((t) => (
        <Link
          key={t.value}
          to="/host"
          search={{ tab: t.value }}
          aria-label={t.label}
          className={headerTabClass(onHost && active === t.value)}
        >
          <t.icon className="size-4" />
          <span className="hidden sm:inline">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Profile menu: setup, package and platform admin. */
export function HostProfileMenu() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useFeatures();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex items-center gap-2">
      <SelectedEventProvider>
        <EventPickerCompact />
      </SelectedEventProvider>
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
            <Link to="/host" search={{ tab: "setup" }}>
              <Settings className="mr-2 size-4" /> Setup
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/upgrade">
              <Sparkles className="mr-2 size-4" /> Your package
            </Link>
          </DropdownMenuItem>
          {isPlatformAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/platform">
                <ShieldCheck className="mr-2 size-4" /> Platform
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
