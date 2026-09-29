import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomCode } from "@/lib/secure-code";

const DAILY_LIMIT = 100;
const gender = z.enum(["men", "women", "boy", "girl"]);
const member = z.object({
  name: z.string().trim().min(2).max(100),
  gender,
  email: z.string().trim().max(255).email().or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
});

const registerSchema = z.object({
  token: z.string().min(16).max(80),
  familyName: z.string().trim().min(2).max(80),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(40),
  gender,
  members: z.array(member).max(30),
});

function familyCode(name: string) {
  const words = name.replace(/[^a-zA-Z ]/g, " ").trim().split(/\s+/);
  const base = (words[words.length - 1] ?? "FAMILY").toUpperCase().slice(0, 8) || "FAMILY";
  return `${base}-${randomCode(8)}`;
}
function memberCode(name: string) {
  const base = name.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 8) || "GUEST";
  return `${base}-${randomCode(8)}`;
}

export type RegisterResult = { ok: boolean; error?: string; code?: string };

/** A family signs itself up through a host's sign-up link and joins that link's events. */
export const registerFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data, context }): Promise<RegisterResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: link } = await supabaseAdmin
      .from("signup_links")
      .select("id, invite_id, event_ids, enabled")
      .eq("token", data.token)
      .maybeSingle();
    if (!link || !link.enabled) return { ok: false, error: "This sign-up link isn't open right now." };

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabaseAdmin
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("signup_link_id", link.id)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT)
      return { ok: false, error: "Too many sign-ups today. Please try again tomorrow." };

    const { data: already } = await supabaseAdmin
      .from("invite_codes")
      .select("id, household")
      .eq("claimed_by", userId)
      .eq("invite_id", link.invite_id)
      .limit(1);
    if (already && already.length > 0)
      return {
        ok: false,
        error: `This account is already part of ${already[0]?.household ? `the family "${already[0]?.household}"` : "a family"} in this celebration. To register a different family, sign out and use a different email.`,
      };

    // Family names are how events are matched, so keep them unique per celebration.
    let name = data.familyName;
    const { data: clash } = await supabaseAdmin
      .from("families")
      .select("name")
      .eq("invite_id", link.invite_id)
      .ilike("name", `${name}%`);
    const taken = new Set((clash ?? []).map((f) => f.name.toLowerCase()));
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${data.familyName} (${n})`;

    const code = familyCode(name);
    const { data: fam, error: famErr } = await supabaseAdmin
      .from("families")
      .insert({ name, code, email: data.email, invite_id: link.invite_id, signup_link_id: link.id })
      .select("id")
      .single();
    if (famErr || !fam) return { ok: false, error: "We couldn't register your family. Please try again." };

    const people = [
      { name: data.fullName, gender: data.gender, email: data.email, phone: data.phone, me: true },
      ...data.members.map((m) => ({ ...m, email: m.email ?? "", phone: m.phone ?? "", me: false })),
    ];
    const now = new Date().toISOString();
    const { error: codeErr } = await supabaseAdmin.from("invite_codes").insert(
      people.map((p) => ({
        code: memberCode(p.name),
        guest_name: p.name,
        email: p.email || null,
        phone: p.phone || null,
        gender: p.gender,
        category: "family",
        household: name,
        family_id: fam.id,
        invite_id: link.invite_id,
        claimed_by: p.me ? userId : null,
        claimed_at: p.me ? now : null,
      })),
    );
    if (codeErr) {
      await supabaseAdmin.from("families").delete().eq("id", fam.id);
      return { ok: false, error: "We couldn't save your family members. Please try again." };
    }

    const events = link.event_ids ?? [];
    if (events.length > 0) {
      await supabaseAdmin.from("household_event_invites").insert(
        events.map((event_id) => ({ household: name, event_id, invite_id: link.invite_id })),
      );
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        invite_claimed: true,
        full_name: data.fullName,
        household: name,
        gender: data.gender,
        phone: data.phone,
      })
      .eq("id", userId);

    return { ok: true, code };
  });

/** A registered family member adds another person to their own family. */
export const addFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => member.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mine } = await supabaseAdmin
      .from("invite_codes")
      .select("family_id, household, invite_id")
      .eq("claimed_by", context.userId)
      .not("family_id", "is", null)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!mine?.family_id) return { ok: false, error: "We couldn't find your family." };
    const { error } = await supabaseAdmin.from("invite_codes").insert({
      code: memberCode(data.name),
      guest_name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      gender: data.gender,
      category: "family",
      household: mine.household,
      family_id: mine.family_id,
      invite_id: mine.invite_id,
    });
    return error ? { ok: false, error: "We couldn't add that person." } : { ok: true };
  });

/** A host removes a family's registration (members, codes, event invites, replies). */
export const deleteFamilyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ familyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fam } = await supabaseAdmin
      .from("families")
      .select("id, name, invite_id")
      .eq("id", data.familyId)
      .maybeSingle();
    if (!fam?.invite_id) return { ok: false, error: "Family not found." };
    const { data: isHost } = await context.supabase.rpc("is_celebration_host", {
      _invite_id: fam.invite_id,
    });
    if (!isHost) return { ok: false, error: "Only this celebration's hosts can do that." };

    const { data: codes } = await supabaseAdmin
      .from("invite_codes")
      .select("claimed_by")
      .eq("family_id", fam.id);
    const users = (codes ?? []).map((c) => c.claimed_by).filter((u): u is string => Boolean(u));

    const scope = { household: fam.name, invite_id: fam.invite_id };
    await supabaseAdmin.from("household_event_invites").delete().match(scope);
    await supabaseAdmin.from("event_attendance").delete().match(scope);
    await supabaseAdmin.from("invite_codes").delete().eq("family_id", fam.id);
    const { error } = await supabaseAdmin.from("families").delete().eq("id", fam.id);
    if (error) return { ok: false, error: "We couldn't delete that family." };
    if (users.length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update({ household: null, invite_claimed: false })
        .in("id", users)
        .eq("household", fam.name);
    }
    return { ok: true };
  });
