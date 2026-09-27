import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /guest/outfits — old links keep working.
export const Route = createFileRoute("/_authenticated/outfits")({
  beforeLoad: () => {
    throw redirect({ to: "/guest/outfits", replace: true });
  },
});
