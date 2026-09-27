import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /guest/invite — old links keep working.
export const Route = createFileRoute("/_authenticated/invite")({
  beforeLoad: () => {
    throw redirect({ to: "/guest/invite", replace: true });
  },
});
