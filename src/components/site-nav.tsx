import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/lib/site-content";
import { GuestTabs } from "@/components/guest-tabs";

const linkClass =
  "rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-primary [&.active]:text-primary";

export function SiteNav() {
  const navigate = useNavigate();
  const { t } = useSiteContent();

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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/invitation" className="font-display text-lg tracking-wide">
          {t("nav.brand", "Our Wedding")}
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link to="/invitation" className={linkClass}>
            {t("nav.invitation", "Your invitation")}
          </Link>
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
        </nav>
      </div>
      <GuestTabs />
    </header>
  );
}
