import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RESERVED_SLUGS } from "@/lib/celebration-slug";

type PublicCelebration = {
  name: string;
  intro: string | null;
  cover_logo_url: string | null;
};

export const Route = createFileRoute("/$celebration")({
  loader: async ({ params }): Promise<PublicCelebration> => {
    const slug = params.celebration.toLowerCase();
    if (RESERVED_SLUGS.has(slug)) throw notFound();
    const { data, error } = await supabase.rpc("celebration_by_slug", { _slug: slug });
    if (error) throw notFound();
    const row = (data ?? null) as PublicCelebration | null;
    if (!row?.name) throw notFound();
    return row;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Not found — My Celebration" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name}`;
    const description =
      loaderData.intro?.slice(0, 180) ??
      `The private page for ${loaderData.name}. Guests sign in with the invitation code they were sent.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: CelebrationMissing,
  component: CelebrationPage,
});

function CelebrationPage() {
  const celebration = Route.useLoaderData();

  return (
    <div className="bg-zari flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 text-center">
        {celebration.cover_logo_url ? (
          <img
            src={celebration.cover_logo_url}
            alt=""
            className="mx-auto mb-8 max-h-24 w-auto object-contain"
          />
        ) : null}
        <p className="text-eyebrow">You're invited</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">{celebration.name}</h1>
        {celebration.intro ? (
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed whitespace-pre-line text-muted-foreground">
            {celebration.intro}
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">I have an invitation code</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ mode: "signin" }}>
              I already registered
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Your own events, replies and details appear once you sign in.
        </p>
      </main>
    </div>
  );
}

function CelebrationMissing() {
  return (
    <div className="bg-zari flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-3xl">We couldn't find that celebration</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The link may have changed. Ask the family who invited you for their page, or sign in with your
        invitation code.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/auth">Sign in with a code</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
