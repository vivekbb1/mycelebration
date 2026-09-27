import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Postmark-style inbound JSON (other forwarders can map to the same fields).
const Payload = z.object({
  From: z.string().optional(),
  FromName: z.string().optional(),
  FromFull: z.object({ Email: z.string() }).partial().optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
  HtmlBody: z.string().optional(),
  MessageID: z.string().optional(),
});

/** Receives forwarded guest emails and files them under the family's Messages. */
export const Route = createFileRoute("/api/public/email/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INBOUND_EMAIL_SECRET"];
        const provided =
          request.headers.get("x-inbound-secret") ?? new URL(request.url).searchParams.get("secret");
        if (!secret || provided !== secret) return new Response("Unauthorized", { status: 401 });

        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const p = parsed.data;
        const sender = (p.FromFull?.Email ?? p.From ?? "").replace(/.*<([^>]+)>.*/, "$1").trim();
        if (!sender) return new Response("No sender", { status: 400 });
        const text =
          p.StrippedTextReply?.trim() ||
          p.TextBody?.trim() ||
          (p.HtmlBody ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        const { storeInbound } = await import("@/lib/inbound.server");
        const result = await storeInbound({
          channel: "email",
          sender,
          senderName: p.FromName ?? null,
          subject: p.Subject ?? null,
          body: text,
          externalId: p.MessageID ? `email:${p.MessageID}` : null,
        });
        return Response.json(result);
      },
    },
  },
});
