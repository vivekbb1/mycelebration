import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const regroupFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    inviteId: z.string().uuid(), source: z.string().min(1).max(120),
    memberIds: z.array(z.string().uuid()).min(1),
    targetId: z.string().uuid().optional(), newName: z.string().trim().min(2).max(80).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("host_regroup_family_members", {
      _invite_id: data.inviteId, _source: data.source, _member_ids: data.memberIds,
      _target_id: data.targetId, _new_name: data.newName,
    });
    if (error) return { ok: false as const, error: error.message };
    const household = result && typeof result === "object" && !Array.isArray(result) ? result["household"] : null;
    if (typeof household !== "string") return { ok: false as const, error: "Couldn't regroup this family." };
    return { ok: true as const, household };
  });