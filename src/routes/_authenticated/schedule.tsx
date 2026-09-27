import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /guest/schedule — old links keep working.
export const Route = createFileRoute("/_authenticated/schedule")({
  beforeLoad: () => {
    throw redirect({ to: "/guest/schedule", replace: true });
  },
});
