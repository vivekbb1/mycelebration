import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /guest/summary — old links keep working.
export const Route = createFileRoute("/_authenticated/summary")({
  beforeLoad: () => {
    throw redirect({ to: "/guest/summary", replace: true });
  },
});
