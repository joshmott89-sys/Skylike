# Database

Applied to Supabase project `skylike` (ref `sroxxxuurhdugvfmwwyw`, Sydney) on 19 Nov 2026, in this order:

1. `core_schema`: households, memberships, members, lists, list_items, notes, calendars, events_cache, countdowns, reminders, devices, commands, photos, household_private, app_private; RLS on every table scoped by `private.is_member(household_id)`; RPCs `create_household`, `join_household`, `set_calendar_bridge`, `calendar_status`; realtime publication; private `photos` storage bucket.
2. `calendar_cron`: pg_net + pg_cron; `calendar-sync` every 5 minutes calls the `calendar` edge function with a secret read from `app_private`; `prune-commands` nightly.
3. `reminder_color`: bin colour on reminders.
4. `calendar_feeds`: private iCal links (`calendar_feeds_private`, server-only), `add_calendar_feed` / `remove_calendar_feed` RPCs, `calendar_status` and the cron trigger now count links as connected.

Pull the exact SQL any time with `supabase db pull` or from the dashboard's migration history.

Isolation test (19 Nov 2026): a member of household A could not read B's notes, households, memberships or bridge settings, could not insert or update B's rows, and could not set B's calendar bridge.
