import { createFileRoute, redirect } from "@tanstack/react-router";

// The portal has been folded into Invite and Schedule — old links land there.
export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: () => {
    throw redirect({ to: "/schedule" });
  },
});
