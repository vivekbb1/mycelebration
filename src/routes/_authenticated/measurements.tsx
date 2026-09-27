import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to /guest/measurements — old links keep working.
export const Route = createFileRoute("/_authenticated/measurements")({
  beforeLoad: () => {
    throw redirect({ to: "/guest/measurements", replace: true });
  },
});
