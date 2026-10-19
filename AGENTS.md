<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Live feeds per event: shop filters per audience, guests claim live, host hide. Why: no bulk importing needed.
- Grouped shop orders snapshot wearer details, prices and measurements in celebration-scoped host-only records, with database validation of discounts and manual payments. Why: offline shop negotiation must remain auditable without changing guest choices.
- Alteration photos use a private celebration-prefixed bucket and signed URLs; shop PDFs are generated in the browser. Why: fitting media and measurements stay host-only and PDF generation needs no server filesystem.
- Host outfit reminders share a pure member/event eligibility helper between the list and email handler. Why: missing choices must be attributed to the wearer consistently.
- Family profile wardrobe choices use a dedicated table component and the shared wearer matching helper. Why: family members must align across event columns without attributing another member’s look to the reserving account.
- Host overview, ordering exports and family selections use shared wearer matching for proxy reservations and measurements. Why: the account selecting a look is not necessarily its wearer.
- Family regrouping uses a host-authorized transactional database RPC and blocks ambiguous shared records or passport file moves. Why: member access, proxy choices and household logistics must never be partially transferred.
- Tenancy: every celebration-owned row carries `invite_id`; RLS uses `is_celebration_host(invite_id)` / `is_guest_of` / `is_my_household`, never `has_role('admin')`. Why: hosts of one celebration must never see another's data.
- Host membership lives in `celebration_hosts`; `user_roles.admin` is only a UI marker synced from it and grants no data. Why: keeps old "is host" checks working without global access.
- A BEFORE INSERT trigger `fill_invite_id` derives `invite_id` from event/outfit/family/household or the caller's single celebration. Why: existing inserts keep working; multi-celebration screens must pass `invite_id` explicitly.
- Storage paths start with the celebration id (`<invite_id>/...`; passports `<invite_id>/<household>/...`). Why: storage rules check the first folder.

- Per-celebration settings override platform defaults: `celebration_email_settings` over `email_settings`, `celebration_content` over `site_content`. Why: hosts reword and send for their own celebration without touching others.
- Packages live on the celebration: `celebration_subscriptions`, `celebration_addons`, `plan_requests.invite_id`; features via `celebration_features(invite_id)`. Why: one upgrade applies to one celebration only.

- Host checks use celebration membership: UI via `useIsAnyHost`/`useIsPlatformAdmin` (src/lib/host-role.ts); server fns via `is_celebration_host(invite_id)`, platform-wide actions via `is_platform_admin`. Never `user_roles`/`has_role(admin)`. Why: co-hosts exist only in celebration_hosts and hosts must not cross celebrations.
- An email belongs to one family per celebration, enforced by the `guard_email_one_family` trigger on invite_codes; self-registration joins an existing unclaimed listing instead of creating a family. Why: stops relatives' duplicate families/accounts.

- Per-person records (reservations, measurements, room assignments, passports, travel travellers) link to the person by invite_code id (`member_code_id` / `traveller_code_ids`); names are display-only and a fallback for unlinked rows. Why: renaming a person must never detach their choices.
