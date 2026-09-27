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
- Tenancy: every celebration-owned row carries `invite_id`; RLS uses `is_celebration_host(invite_id)` / `is_guest_of` / `is_my_household`, never `has_role('admin')`. Why: hosts of one celebration must never see another's data.
- Host membership lives in `celebration_hosts`; `user_roles.admin` is only a UI marker synced from it and grants no data. Why: keeps old "is host" checks working without global access.
- A BEFORE INSERT trigger `fill_invite_id` derives `invite_id` from event/outfit/family/household or the caller's single celebration. Why: existing inserts keep working; multi-celebration screens must pass `invite_id` explicitly.
- Storage paths start with the celebration id (`<invite_id>/...`; passports `<invite_id>/<household>/...`). Why: storage rules check the first folder.
