import { createFileRoute, redirect } from "@tanstack/react-router";

// Old guest page — everything now lives on Summary.
export const Route = createFileRoute("/_authenticated/plan")({
  beforeLoad: () => {
    throw redirect({ to: "/summary" });
  },
});
