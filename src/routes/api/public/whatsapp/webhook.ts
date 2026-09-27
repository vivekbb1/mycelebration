import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type WaMessage = { id: string; from: string; type: string; text?: { body: string }; button?: { text: string } };

/** WhatsApp Cloud API webhook: guest replies land in their family's Messages. */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (
          token &&
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === token
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const appSecret = process.env["WHATSAPP_APP_SECRET"];
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256") ?? "";
        if (!appSecret) return new Response("Not configured", { status: 500 });
        const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
        if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        const { storeInbound } = await import("@/lib/inbound.server");
        for (const entry of payload?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const value = change?.value ?? {};
            const names = new Map<string, string>(
              (value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]),
            );
            for (const m of (value.messages ?? []) as WaMessage[]) {
              const body = m.text?.body ?? m.button?.text ?? `(${m.type} message)`;
              await storeInbound({
                channel: "whatsapp",
                sender: m.from,
                senderName: names.get(m.from) ?? null,
                body,
                externalId: `wa:${m.id}`,
              });
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
