import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/lib/site-content";
import { useBranding } from "@/lib/branding";
import { GuestTabs } from "@/components/guest-tabs";

const linkClass =
  "rounded-full px-3 py-1.5 text-xs tracking-wide uppercase text-muted-foreground transition-colors hover:text-primary [&.active]:text-primary";

const GUEST_TAB_PATHS = ["/invitation", "/portal", "/event", "/lookbook", "/confirm", "/measurements", "/plan"];

/** Host-side pages belong back on the host page; everything else on the invitation. */
const HOST_PATHS = ["/guests", "/guest", "/host", "/hosts", "/platform"];

export function SiteNav() {
  const navigate = useNavigate();
  const { t } = useSiteContent();
  const { branding } = useBranding();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const onGuestTab = GUEST_TAB_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isHostPage = HOST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const backTo = isHostPage && pathname !== "/host" ? "/host" : "/invitation";
  const backLabel =
    backTo === "/host" ? "Back to host" : t("nav.back", "Back to your invitation");

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

  const { data: isStylist } = useQuery({
    queryKey: ["is-stylist"],
    queryFn: async () => {
      const { data } = await supabase.from("boutique_members").select("id").limit(1);
      return Boolean(data && data.length > 0);
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          to="/invitation"
          className="font-display flex shrink-0 items-center truncate text-base tracking-wide sm:text-lg"
        >
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={t("nav.brand", "Our Wedding")}
              style={{ height: Math.min(branding.logo_height, 40) }}
              className="w-auto"
            />
          ) : (
            t("nav.brand", "Our Wedding")
          )}
        </Link>

        <div className="mx-auto min-w-0">
          {onGuestTab ? (
            <GuestTabs />
          ) : pathname === "/host" ? null : (
            <Link
              to={backTo}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" />
              <span className="truncate">{backLabel}</span>
            </Link>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isStylist ? (
            <Link to="/atelier" className={linkClass}>
              Atelier
            </Link>
          ) : null}
          {isAdmin ? (
            <Link to="/host" className={linkClass}>
              Host
            </Link>
          ) : null}
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
