# Infrastructure debt: production migration history is missing 044–046

Found by the read-only production audit on 2026-09-27 (journey commercial ownership release).

## What

`supabase_migrations.schema_migrations` in production (`ugekpmogiecfsmydyjxr`) records, in order:

```
… 20260926000014  042_newsletter_subscribers
  20260926000015  sinai_package_commercial_content   (repo: 043)
  20260926193550  site_pages                         (repo: 047)
  20260926193807  ops_edition_requests               (repo: 048)
```

There are no history rows for the repo's `044_weemap_editions.sql`, `045_editions_server_only_reads.sql`
or `046_editions_public_experience_wording.sql`. Their objects do exist: production's `ops_work_items`
view already contains the `edition_request` branch that 048 adds on top of 044's tables.

The recorded names also drift from the repo filenames (043, 047, 048 were recorded without their number prefix).

## Why it matters

- A tool that replays "unapplied" migrations from history (for example `supabase db push`) could try to re-run
  044–046 against production.
- Anyone auditing production from the history table gets a wrong picture of what was applied.

## Not done in the journey release

The owner decided on 2026-09-27 not to touch the history records in this release. Migrations 049 and 050
are applied the same way as 047/048, and are expected to add their own history rows.

## Suggested fix (separate change, needs approval)

1. Read-only check: for each object 044–046 create, confirm it exists in production and matches the repo.
2. If they all match, insert the three missing history rows (with versions ordered between 043 and 047) in one
   reviewed transaction. Do not re-run the migrations.
3. Decide on one naming convention for history names (with or without the `NNN_` prefix) and document it.
