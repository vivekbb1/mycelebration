import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address — kept so existing links and emails still work.
export const Route = createFileRoute("/_authenticated/confirm")({
  beforeLoad: () => {
    throw redirect({ to: "/summary" });
  },
});
