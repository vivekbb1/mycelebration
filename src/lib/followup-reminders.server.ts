import { emailShell, escapeHtml, sendGuestEmail } from "./email.server";

export type ReminderRun = {
  due: number;
  hosts: number;
  sent: number;
  skipped: string[];
};

const DAYS_AHEAD = 2;

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Emails every host a short list of the guests they look after whose follow-up
 * date is here, near or past. Each note is only ever reminded about once.
 */
export async function runFollowUpReminders(): Promise<ReminderRun> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const horizon = new Date(today.getTime() + DAYS_AHEAD * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: notes } = await supabaseAdmin
    .from("guest_communications")
    .select("id, invite_id, host_id, channel, outcome, notes, follow_up_on")
    .not("follow_up_on", "is", null)
    .lte("follow_up_on", horizon)
    .is("reminder_sent_at", null)
    .order("follow_up_on");

  const rows = notes ?? [];
  if (rows.length === 0) return { due: 0, hosts: 0, sent: 0, skipped: [] };

  const inviteIds = [...new Set(rows.map((r) => r.invite_id))];
  const [{ data: guests }, { data: links }] = await Promise.all([
    supabaseAdmin.from("invite_codes").select("id, guest_name, household").in("id", inviteIds),
    supabaseAdmin.from("guest_hosts").select("invite_id, host_id").in("invite_id", inviteIds),
  ]);

  const guestById = new Map((guests ?? []).map((g) => [g.id, g]));
  const hostsForInvite = new Map<string, string[]>();
  for (const l of links ?? []) {
    hostsForInvite.set(l.invite_id, [...(hostsForInvite.get(l.invite_id) ?? []), l.host_id]);
  }

  // One bundle per host.
  const perHost = new Map<string, typeof rows>();
  for (const row of rows) {
    const hostIds = hostsForInvite.get(row.invite_id) ?? (row.host_id ? [row.host_id] : []);
    for (const hostId of hostIds) {
      perHost.set(hostId, [...(perHost.get(hostId) ?? []), row]);
    }
  }
  if (perHost.size === 0) return { due: rows.length, hosts: 0, sent: 0, skipped: ["no_host_assigned"] };

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", [...perHost.keys()]);

  let sent = 0;
  const skipped: string[] = [];
  const remindedIds: string[] = [];

  for (const [hostId, items] of perHost) {
    const profile = (profiles ?? []).find((p) => p.id === hostId);
    const to = (profile?.email ?? "").trim();
    if (!to) {
      skipped.push("host_without_email");
      continue;
    }
    const first = (profile?.full_name ?? "").trim().split(" ")[0] || "there";

    const list = items
      .map((item) => {
        const guest = guestById.get(item.invite_id);
        const overdue = (item.follow_up_on ?? "") < todayIso;
        const when = item.follow_up_on ? prettyDate(item.follow_up_on) : "";
        return `<li style="margin:0 0 10px">
            <strong>${escapeHtml(guest?.guest_name ?? "A guest")}</strong>${
              guest?.household ? ` <span style="color:#8a6b64">· ${escapeHtml(guest.household)}</span>` : ""
            }<br/>
            <span style="color:${overdue ? "#a3342f" : "#8a6b64"}">
              ${overdue ? "Overdue since" : "Follow up"} ${escapeHtml(when)}
            </span>${
              item.notes ? `<br/><span style="color:#8a6b64">${escapeHtml(item.notes)}</span>` : ""
            }
          </li>`;
      })
      .join("");

    const result = await sendGuestEmail({
      to,
      subject: `${items.length} guest follow-up${items.length === 1 ? "" : "s"} waiting on you`,
      html: emailShell(
        `<p>Dear ${escapeHtml(first)},</p>
         <p>A gentle nudge — these guests are due a word from you.</p>
         <ul style="padding-left:18px">${list}</ul>
         <p>Open the guest list on the wedding site to record how the conversation went.</p>`,
      ),
    });

    if (result.sent) {
      sent += 1;
      for (const item of items) remindedIds.push(item.id);
    } else if (result.reason) {
      skipped.push(result.reason);
    }
  }

  if (remindedIds.length > 0) {
    await supabaseAdmin
      .from("guest_communications")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in("id", [...new Set(remindedIds)]);
  }

  return { due: rows.length, hosts: perHost.size, sent, skipped: [...new Set(skipped)] };
}
