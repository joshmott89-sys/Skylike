# Skylike

A calm family screen for a wall tablet, with a phone companion. Today drawn as a sky, calendars from Google, lists, notes, bin nights, WA school terms and public holidays, a babysitter page and a night mode. No subscriptions.

- **App:** https://joshmott89-sys.github.io/Skylike/
- **Try it with sample data (nothing saved):** https://joshmott89-sys.github.io/Skylike/?demo

## How it fits together

| Part | What it does |
| --- | --- |
| `index.html` | The whole app: tablet family screen, Focus and Planner views, phone layout |
| Supabase (Sydney) | Sign-in, database with row level security, live sync, photo storage |
| `supabase/functions/calendar` | Syncs calendar links (iCal) and the optional two-way bridge every 5 minutes |
| `apps-script/bridge.gs` | Runs in a parent's Google account; reads and writes their calendars |
| `.github/workflows` | Daily keep-alive ping; optional weekly encrypted backup |

## One-time setup (Josh)

1. **Supabase sign-in emails** (Authentication → Email Templates): in both **Magic Link** and **Confirm signup**, add the line `Your code: {{ .Token }}`. Home-screen apps on iPhone and iPad can't open email links, so people type the code instead.
2. **Supabase URL configuration** (Authentication → URL Configuration): set Site URL to `https://joshmott89-sys.github.io/Skylike/` and add it to Redirect URLs.
3. **GitHub Pages** (repo Settings → Pages): deploy from `main`, root folder.

## Setting up a family

1. Open the app on a parent's phone, sign in with the emailed code, choose **Set up our household**.
2. Settings → Family: add the other parent and the kids, pick colours, and set each adult's home view (Focus or Planner).
3. Settings → Household: give the partner the join code.
4. Settings → Calendar → **Add a calendar**: paste each Google calendar's *Secret address in iCal format* (calendar.google.com → Settings → the calendar → Integrate calendar). Read-only, refreshed every 5 minutes.
   Optional, on a computer: **Two-way editing** (Copy script → script.new → deploy as web app → paste the URL) so the screen can add and move events later.
5. Settings → Reminders: add bin days and countdowns. Settings → Babysitter: contacts, bedtimes, wifi.

## The tablet

Keep it plugged in. Open the app in Safari (iPad) or Chrome (Android), sign in, then **Add to Home Screen** and open it from the icon. In Settings → Screen, set it to act as the **Family screen**.

- **iPad:** Settings → Display & Brightness → Auto-Lock → Never. Settings → Accessibility → Guided Access → On; open Skylike and triple-click the top button to lock it to the app.
- **Android:** Developer options → Stay awake while charging. Settings → Security → App pinning → On; pin Skylike.

The screen dims to dusk colours at night and fades to a dim clock after two minutes untouched. Daytime photo slideshow starts when nobody's used it for a while (Settings → Photos).

## Remote help

Settings → Devices lists every signed-in screen with when it was last seen. **Refresh** reloads one screen, or all of them, without a visit. The app also reloads itself quietly at 3am and after repeated errors.

## Backups (optional)

Set repository variable `BACKUPS_ENABLED=true` and secrets `SUPABASE_DB_URL` (Supabase → Connect → session pooler string) and `BACKUP_PASSPHRASE`. A weekly encrypted dump is kept as a workflow artifact for 60 days.

## Data sources

WA public school terms from the Department of Education (education.wa.edu.au/future-term-dates); WA public holidays from wa.gov.au. Both checked November 2026 and cover 2026–2027.
