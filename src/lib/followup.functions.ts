import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FollowUpSuggestion = {
  status: string;
  next_step: string;
  message: string;
  suggested_follow_up_days: number;
};

export type FollowUpResult = {
  ok: boolean;
  error?: string;
  suggestion?: FollowUpSuggestion;
};

const schema = z.object({ inviteId: z.string().uuid() });

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      description: "A short label for where this guest stands, e.g. 'Waiting on their reply'.",
    },
    next_step: {
      type: "string",
      description: "One sentence telling the host what to do next.",
    },
    message: {
      type: "string",
      description:
        "A warm, ready-to-send message of 2-4 sentences the host can send this guest, signed off by the host's first name.",
    },
    suggested_follow_up_days: {
      type: "integer",
      description: "How many days from today the host should follow up again (1-30).",
    },
  },
  required: ["status", "next_step", "message", "suggested_follow_up_days"],
} as const;

/** Reads the streamed Responses API reply and returns the joined answer text. */
async function readResponsesText(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload);
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && !text) {
          text = event.response?.output_text ?? "";
        }
      } catch {
        // partial frame — keep reading
      }
    }
  }
  return text;
}

/**
 * Looks at everything recorded about a guest — their replies, outfit, travel and
 * the host's own notes — and suggests how to follow up next.
 */
export const suggestFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }): Promise<FollowUpResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "Only a host can do this." };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "AI is not set up for this site yet." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: guest } = await supabaseAdmin
      .from("invite_codes")
      .select("id, guest_name, household, email, gender, personally_invited, claimed_by")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!guest) return { ok: false, error: "That guest is no longer on the list." };

    const [{ data: history }, { data: hostProfile }, { data: family }] = await Promise.all([
      supabaseAdmin
        .from("guest_communications")
        .select("channel, outcome, notes, follow_up_on, contacted_at")
        .eq("invite_id", guest.id)
        .order("contacted_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
      guest.household
        ? supabaseAdmin
            .from("families")
            .select("needs_wardrobe")
            .eq("name", guest.household)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const { data: guestProfile } = guest.claimed_by
      ? await supabaseAdmin
          .from("profiles")
          .select("rsvp_status, rsvp_note")
          .eq("id", guest.claimed_by)
          .maybeSingle()
      : { data: null };

    const hostName = (hostProfile?.full_name ?? "").trim() || "the host";
    const lines = [
      `Guest: ${guest.guest_name}`,
      `Family: ${guest.household ?? "not grouped"}`,
      `Email on file: ${guest.email ?? "none"}`,
      `Registered on the site: ${guest.claimed_by ? "yes" : "no"}`,
      `Reply so far: ${guestProfile?.rsvp_status ?? "not registered"}${
        guestProfile?.rsvp_note ? ` — "${guestProfile.rsvp_note}"` : ""
      }`,
      `Outfit comes from the hosts: ${family?.needs_wardrobe === false ? "no" : "yes"}`,
      `Invited personally already: ${guest.personally_invited ? "yes" : "no"}`,
      "",
      "Contact history, newest first:",
      ...(history ?? []).map(
        (h) =>
          `- ${new Date(h.contacted_at).toISOString().slice(0, 10)} · ${h.channel} · ${h.outcome}${
            h.follow_up_on ? ` · follow up ${h.follow_up_on}` : ""
          }${h.notes ? ` · note: ${h.notes}` : ""}`,
      ),
    ];
    if (!history || history.length === 0) lines.push("- nothing recorded yet");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        store: false,
        instructions:
          `You help ${hostName}, a host of an Indian wedding, keep in warm personal touch with ` +
          "invited guests. Today is " +
          new Date().toISOString().slice(0, 10) +
          ". Write in a warm, respectful, family tone — never salesy, never pushy. " +
          "Base everything strictly on the record given; never invent dates, flights or promises.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  lines.join("\n") +
                  "\n\nSuggest how to follow up with this guest next, and draft the message to send.",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "follow_up",
            strict: true,
            schema: RESULT_SCHEMA,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("AI follow-up failed", res.status, body);
      if (res.status === 402) {
        return { ok: false, error: "The workspace is out of AI credits — top up to use this." };
      }
      if (res.status === 429) {
        return { ok: false, error: "Too many requests just now — try again in a moment." };
      }
      return { ok: false, error: "The suggestion could not be produced just now." };
    }

    const text = await readResponsesText(res);
    try {
      const parsed = JSON.parse(text) as FollowUpSuggestion;
      const days = Math.min(30, Math.max(1, Number(parsed.suggested_follow_up_days) || 3));
      return { ok: true, suggestion: { ...parsed, suggested_follow_up_days: days } };
    } catch {
      return { ok: false, error: "The suggestion came back unreadable — try again." };
    }
  });
