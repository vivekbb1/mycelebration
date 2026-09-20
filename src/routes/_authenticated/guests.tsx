import { createFileRoute, redirect } from "@tanstack/react-router";

/** The guest list now lives inside the host area, under Guests → List. */
export const Route = createFileRoute("/_authenticated/guests")({
  beforeLoad: () => {
    throw redirect({ to: "/host" });
  },
  component: () => null,
});
