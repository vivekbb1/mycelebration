import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Settings, ShieldCheck, Sparkles, User } from "lucide-react";

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

const tabClass =
  "rounded-full px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary";

/** The host tabs that live in the top bar. */
export function HostTabs() {
  const { has } = useFeatures();
  const active = useRouterState({
    select: (s) => (s.location.search as { tab?: string })?.tab ?? "overview",
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHost = pathname === "/host";

  const tabs = [
    { value: "overview", label: "Overview", show: true },
    { value: "invitations", label: "Celebration", show: true },
    { value: "functions", label: "Events", show: has("functions") },
    { value: "guests", label: "Guests", show: has("guest_list") },
    { value: "wardrobe", label: "Wardrobe", show: has("wardrobe_picker") },
  ].filter((t) => t.show);

  return (
    <nav className="flex items-center gap-1">
      {tabs.map((t) => (
        <Link
          key={t.value}
          to="/host"
          search={{ tab: t.value }}
          className={`${tabClass} ${onHost && active === t.value ? "text-primary" : ""}`}
        >
          {t.label}
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
