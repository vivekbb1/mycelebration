import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { RESERVED_SLUGS } from "@/lib/celebration-slug";
import { useSignupLink } from "@/lib/signup-link";

import {
  celebrationStyle,
  fetchCelebrationBySlug,
  type PublicCelebration,
} from "@/lib/public-celebration";

export const Route = createFileRoute("/$celebration")({
  validateSearch: z.object({ t: z.string().max(80).optional().catch(undefined) }),
  loader: async ({ params }): Promise<PublicCelebration> => {
    const slug = params.celebration.toLowerCase();
    if (RESERVED_SLUGS.has(slug)) throw notFound();
    const row = await fetchCelebrationBySlug(slug);
    if (!row) throw notFound();
    return { ...row, slug: row.slug ?? slug };
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
    const url = `https://mycelebration.app/${loaderData.slug}`;
    const image = [loaderData.cover_logo_url, loaderData.bg_url].find(
      (u) => u && /^https:\/\//i.test(u),
    );
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  notFoundComponent: CelebrationMissing,
  component: CelebrationPage,
});

function CelebrationPage() {
  const celebration = Route.useLoaderData();
  const { t: token } = Route.useSearch();
  const signup = useSignupLink(token);
  const [askLink, setAskLink] = useState(false);

  return (
    <div
      className="bg-zari flex min-h-dvh flex-col bg-background"
      style={celebrationStyle(celebration)}
    >
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
          {token && signup.data ? (
            <Button asChild size="lg">
              <Link to="/$celebration/register" params={{ celebration: celebration.slug ?? "" }} search={{ t: token }}>
                Register our family
              </Link>
            </Button>
          ) : null}
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signin", c: celebration.slug ?? undefined }}>
              Sign in
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ c: celebration.slug ?? undefined }}>
              I have an invite code
            </Link>
          </Button>
          {!(token && signup.data) ? (
            <Button size="lg" variant="outline" onClick={() => setAskLink((v) => !v)}>
              Request a registration link
            </Button>
          ) : null}
        </div>
        {askLink ? (
          <p className="mx-auto mt-4 max-w-md rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
            Registration links come from the hosts. Ask the family who invited you to send you their
            registration link, then open it to register your family.
          </p>
        ) : null}
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
