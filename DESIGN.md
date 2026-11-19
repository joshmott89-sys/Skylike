---
name: Skylike
description: Your family's day on one calm screen.
colors:
  ocean: "#0B4F6C"
  ocean-bright: "#126C8F"
  ocean-ink: "#E6F2F7"
  ocean-ink-muted: "#9CC3D3"
  apricot: "#F2A65A"
  apricot-ink: "#7A4210"
  sand: "#E9DDC8"
  sand-ink: "#5E4B2E"
  sea-mist: "#E8EFF1"
  surface: "#F8FBFC"
  raise: "#FFFFFF"
  ink: "#10293A"
  ink-2: "#46606F"
  ink-3: "#6B8290"
  line: "rgba(0,0,0,.10)"
  ok: "#3E8A63"
  warn: "#C98A12"
  bad: "#C24A3A"
  family-ocean: "#2F7BB5"
  family-jacaranda: "#7B5EA7"
  family-wattle: "#D49A12"
  family-eucalypt: "#3F8A68"
  family-banksia: "#D9773B"
  family-reef: "#D2526D"
  family-coast: "#3A9AA0"
  family-granite: "#66727E"
  note-sand: "#EADFC9"
  note-sea: "#CDE7E0"
  note-wattle: "#F6E2A0"
  note-jacaranda: "#E1D6F1"
  note-coral: "#F6D1CB"
  note-sky: "#D3E6F4"
  night-ground: "#0C1424"
  night-surface: "#121C30"
  night-raise: "#17233B"
  night-ink: "#B9C6D6"
  night-ink-2: "#8697AB"
  night-rail: "#08101E"
  night-ocean-bright: "#13233D"
  night-apricot: "#C98B52"
typography:
  display:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(64px, 9.4vw, 112px)"
    fontWeight: 650
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "clamp(36px, 4.6vw, 58px)"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  page-title:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 750
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  event:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.2
  body:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  nav:
    fontFamily: "Nunito, ui-rounded, SF Pro Rounded, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    letterSpacing: "0.01em"
rounded:
  pill: "99px"
  sheet: "28px"
  zone: "22px"
  day: "18px"
  note: "16px"
  control: "14px"
  inset: "12px"
  check: "10px"
spacing:
  rail: "92px"
  pad: "22px"
  pad-phone: "16px"
  gap: "18px"
  gap-s: "12px"
  zone-padding: "20px 22px"
components:
  button-primary:
    backgroundColor: "{colors.ocean}"
    textColor: "{colors.raise}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  button-soft:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  button-ghost:
    textColor: "{colors.ocean-bright}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  button-capture:
    backgroundColor: "{colors.apricot}"
    textColor: "#3D2208"
    rounded: "{rounded.pill}"
    padding: "16px 24px 16px 18px"
  input:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "50px"
  zone:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.zone}"
    padding: "20px 22px"
  chip-reminder:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px 8px 8px"
  tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  tab-active:
    backgroundColor: "{colors.ocean}"
    textColor: "{colors.raise}"
  rail-nav-active:
    textColor: "{colors.raise}"
    rounded: "{rounded.day}"
    width: "68px"
    height: "62px"
  sky-pill:
    backgroundColor: "rgba(255,255,255,.92)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  face:
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: Skylike

## Overview

**Creative North Star: "Today Is a Sky"**

Skylike is a Perth coastal morning turned into a family calendar. The top of every home view is the real day's sky, 6am to 9pm, painted by the actual hour: dawn violet, midday Indian Ocean blue, apricot sunset, dusk navy. A sun (a moon after dark) sits at now; the family's events stand on its horizon as white pills tied by stems to colour marks on the timeline. Everything below the horizon is calm ground: sea-mist, limestone-sand accents, soft rounded fields with almost no lines.

The system is built for glancing from across a hallway. Numerals are huge and tabular, type is a single rounded face in heavy weights, and each screen carries a few large things rather than many small ones. Colour is spent on people (each family member owns a flora colour) and on now (apricot); structure is carried by tone and soft shadow, not borders. At night the whole palette is swapped, not dimmed: ground, surfaces, rail and type move to low-luminance dusk navy and family colours desaturate, so the screen never glows in a dark room.

It rejects the category default of white cards over a colour-coded agenda grid, and it rejects dashboard density and cold, techy chrome.

**Key Characteristics:**
- A live sky band whose gradient follows the true time of day, with sun or moon at now.
- One rounded face (Nunito, self-hosted variable) at 600-750 weight; tabular numerals for every time.
- Deep ocean rail on the left (tablet) or a sea-mist tab bar (phone); everything else floats on sea-mist ground.
- Generous radius everywhere, pill shapes for anything tappable-and-small, soft offset shadows, near-zero borders.
- Family colours from local flora identify people; apricot means now.
- A full night palette swap at low luminance, plus a near-black idle clock.

## Colors

A cool coastal palette: sea-mist ground, one deep ocean anchor, one warm apricot for now, and a named set of flora colours reserved for people.

### Primary
- **Indian Ocean Deep** (ocean): the left rail, primary buttons, active tabs and segmented controls. The one heavy colour on any screen.
- **Shallow Water** (ocean-bright): text links ("Week", "All lists"), ghost buttons, focus rings and input focus borders, the phone tab bar's active item.
- **Spray / Wet Sand Blue** (ocean-ink, ocean-ink-muted): type and icons on the rail; muted for inactive nav, full for hover.

### Secondary
- **Sunset Apricot** (apricot): now and only now. The ring on the live sky pill and mark, the ring around today in week and month, the selected face's ring, the Focus "leave in" meter, the capture button. Its ink partner **Burnt Apricot** (apricot-ink) sets time-critical text on apricot tints (next-event time, "Leave in 10 min", holiday labels).

### Tertiary
- **Limestone Sand** (sand, sand-ink): quiet warm fields for codes and passwords to be read aloud (wifi, join code). Used sparingly.

### Neutral
- **Sea Mist** (sea-mist): the app ground. Cool, never cream.
- **Foam** (surface): zones, panels, chips, tabs, day cells.
- **White Water** (raise): inputs and the base that member-colour tints mix into.
- **Deep Harbour Ink** (ink), **Channel Grey** (ink-2), **Weathered Grey** (ink-3): primary text, secondary text and meta, tertiary text and empty states and unchecked boxes.
- **Hairline** (line): the only divider, between list rows and events; also the inactive track for toggles and meters.

### Family and Status
- **Flora set** (family-ocean, -jacaranda, -wattle, -eucalypt, -banksia, -reef, -coast, -granite): one per member, picked in settings. Shown as solid face discs, pill dots, timeline marks, and 14-22% tints behind week events and kid avatars.
- **Note papers** (note-sand, -sea, -wattle, -jacaranda, -coral, -sky): pale sticky-note grounds with fixed dark-brown text (#2B2416).
- **Status** (ok, warn, bad): checked boxes, toggles on, sync dot; emergency contact and destructive actions. Status chips use 14-18% tints of their colour.

### Night
Night tokens replace the day set wholesale on `body.night` (night-ground, night-surface, night-raise, night-ink, night-ink-2, night-rail, night-ocean-bright, night-apricot). Faces drop to saturate .55 brightness .72; notes to brightness .55. The idle overlay is near-black (#03060C) with a dim slate clock (#55627A).

### Named Rules
**The Apricot Means Now Rule.** Apricot marks the present moment, the person whose view this is, or time pressure. It never decorates, and no second warm accent competes with it.

**The People Own Colour Rule.** Flora colours identify a family member and nothing else. Chrome, headings and controls stay ocean and ink; a reminder chip borrows a flora disc only as the badge behind its icon.

**The Swap, Don't Dim Rule.** Night is a separate palette at low luminance, not an opacity layer over the day palette.

## Typography

**Display Font:** Nunito variable, self-hosted (with ui-rounded, SF Pro Rounded, system-ui)
**Body Font:** Nunito (same stack)
**Label/Mono Font:** ui-monospace, Menlo, only for codes to be typed (wifi password, join code)

**Character:** One soft, rounded face doing everything, set heavy (600 body, 650-750 headings) so it reads from a room away without feeling technical. Times are always tabular.

### Hierarchy
- **Display** (650, clamp(64px, 9.4vw, 112px), 0.92, -0.035em): the sky clock only. The am/pm suffix sits at 0.3em, 600, 85% opacity. Compact phone sky uses 52px; the night idle clock grows to clamp(80px, 14vw, 170px). Weather temperature shares the voice at clamp(40px, 5vw, 60px).
- **Headline** (750, clamp(36px, 4.6vw, 58px), 1.05, -0.03em): the Focus hero event name; "leave in" sits at clamp(26px, 3vw, 38px) with its number at 1.4em.
- **Page title** (750, 34px, -0.02em; 28px on phone): top of Calendar, Lists, Notes, Sitter, Settings.
- **Title** (700, 21px, -0.01em): zone and panel headings ("Up next", "Lists"); sheet headings 24px.
- **Event** (650, 21px, 1.2): event names in Up next; the next event steps up to 26px. Times beside them 700, 17px in ink-2.
- **Body** (600, 18px, 1.4; 17px on phone): list items (19px), notes, help text (16.5px).
- **Label** (700, 15px): field labels, list-group tags ("Groceries · 4", 14px in ink-3), sentence case. Rail nav labels 600, 12.5px; phone tab bar 700, 11.5px.

### Named Rules
**The One Face Rule.** Nunito carries every role. Monospace appears only where a person must copy characters exactly.

**The Tabular Time Rule.** Every time, count and temperature uses tabular numerals so the clock never jitters and columns of times align.

**The Sentence Case Rule.** Labels and group tags are sentence case at normal tracking; nothing is uppercase-spaced.

## Layout

Tablet (landscape, above 760px): a 92px ocean rail on the left (faces, view switcher, sync dot pinned to the bottom) and a main column. Home views open with the sky band at clamp(230px, 35vh, 330px), then a row of reminder chips, then a board of three zones (1.15fr / 1fr / 1fr, 18px gap) that fills the remaining height without page scroll; zones scroll internally and fade out at the bottom with a mask instead of a hard cut. Focus uses a 1.4fr / 1fr split with a single hero. Inner pages cap at 1180px with 22px side padding.

Between 761px and 1100px the board drops to two columns with Notes spanning the full width. At 760px and below the rail becomes a five-item bottom tab bar, the sky goes compact (marks only, smaller clock and weather), page padding drops to 16px, and every grid collapses to one column; week becomes a vertical day list.

Rhythm: 22px outer padding, 18px between zones, 12-14px within groups, 9-12px list-row padding. All edges respect safe-area insets. Touch targets are at least 48px (buttons, icon buttons, inputs 50px, checkboxes 32px inside 48px rows, faces 56px).

## Elevation & Depth

A hybrid: tone does most of the work (foam fields on sea-mist ground), and one soft offset shadow lifts every field the same small amount. There are no borders around fields. Rings, not shadows, signal state.

### Shadow Vocabulary
- **Field lift** (`box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 10px 28px -14px rgba(0,0,0,.22)`): zones, panels, chips, tabs, segmented controls, day cells, icon buttons, toasts. Night: `0 1px 2px rgba(0,0,0,.3), 0 10px 28px -14px rgba(0,0,0,.6)`.
- **Sky pill** (`box-shadow: 0 6px 18px -8px rgba(0,0,0,.45)`): event pills floating in the sky.
- **Paper** (`box-shadow: 0 1px 1px rgba(0,0,0,.05), 0 8px 18px -12px rgba(0,0,0,.35)`): sticky notes.
- **Floating action** (`box-shadow: 0 10px 26px -10px rgba(0,0,0,.35)`): the capture button.
- **Sheet** (`box-shadow: 0 -10px 40px -10px rgba(0,0,0,.3)`): bottom sheets over a rgba(10,24,34,.38) scrim.
- **Now ring** (`box-shadow: 0 0 0 3px var(--apricot)`): today's day or month cell, the live pill and mark, added on top of the element's own lift.

### Named Rules
**The One Lift Rule.** Every resting field uses the same field-lift shadow. Depth differences come from tone, not from stacking more shadow.

**The Ring For State Rule.** Selection and now are 3px rings (apricot for now, ink for chosen swatch, ocean-bright for focus), never heavier shadows.

## Shapes

Soft and pebble-like. Fields are large rounded rectangles (22px zones, 28px hero, sheets and gate card, 20px contact cards, 18px day cells and rail buttons, 16px notes). Controls are 14px (buttons, inputs, segmented control); small inset tags 10-12px. Anything small that is tapped or carries a person is a full pill or circle: faces, sky pills, chips, tabs, status chips, toggles, swatches, member dots. Sticky notes alone tilt, by fixed small angles between -1.2 and 1.1 degrees, so the notes board reads as paper on a fridge. Checkboxes are rounded squares (10px radius, 2.5px ink-3 stroke) that fill solid ok-green when done.

## Components

### Buttons
Solid, roomy and quiet.
- **Shape:** gently rounded (14px), min height 48px.
- **Primary:** ocean fill, white 700 text at 17px, 12px 18px padding. Night: ocean-bright fill with ocean-ink text.
- **Hover / Focus / Active:** brightness 1.08 on hover; 3px ocean-bright outline at 2px offset on focus; scale .98 on press.
- **Soft:** foam fill, ink text, field lift. **Ghost:** transparent, ocean-bright text. **Destructive:** bad fill.
- **Capture:** the one floating action, an apricot pill with a heavy plus and "Add", bottom right, raised above the phone tab bar.

### Chips
- **Reminder chips:** foam pills with field lift leading the area under the sky (bin night, countdowns, school terms, holidays). A 30px coloured disc holds a line icon; a bold title is followed by an ink-2 qualifier ("out tonight", "36 sleeps").
- **Tabs:** foam pills, ink-2 text; active is ocean fill with white text and a translucent count badge.
- **Status:** tinted pills in ok, warn or bad.

### Cards / Containers
- **Corner Style:** 22px (zone, panel), 28px (Focus hero), 20px (contact).
- **Background:** foam on sea-mist; emergency contact tints toward bad at 10%.
- **Shadow Strategy:** field lift (see Elevation).
- **Border:** none.
- **Internal Padding:** 20px 22px zones; 22px panels; 30px 34px hero.

### Inputs / Fields
- **Style:** white-water fill, 2px hairline stroke, 14px radius, 50px min height, 18px text. Labels above in 700, 15px, ink-2.
- **Focus:** stroke shifts to ocean-bright.
- **Toggles:** 56x32 pill, hairline track, white knob; on turns ok-green.

### Navigation
- **Tablet rail:** ocean column; member faces (56px circles, initial or emoji, member colour) at top, divided by a faint line from the view buttons (24px line icon over a 12.5px label). Active view gets a translucent white 18px-radius tile and white text; the active parent's face gets an apricot ring and scales 1.06. Sync dot at the bottom.
- **Phone tab bar:** foam bar with a top hairline, five equal items, ink-3 by default, ocean-bright when active.

### Event List
Up next rows: time on the left (700, 17px, ink-2), event name and who on the right, separated by hairlines. The next event's time sits in an apricot-tinted 12px tag in apricot-ink and its name steps up to 26px. Who shows as a member-colour dot, or for kids a tinted circle with their emoji avatar.

### Sticky Notes
Pale note-colour papers, 16px radius, slight fixed tilt, paper shadow, dark brown 600 text, author in small bold at the bottom, a faint close cross top right. On the home board they fade out under a mask rather than clipping.

### Sky Band (signature)
A vertical two-stop gradient interpolated from eleven time-of-day keyframes (night, dawn, morning, midday, golden hour, sunset, dusk), crossfading over 2s. Clock and date top left, weather icon and temperature top right, all white with a faint text shadow. A translucent ocean water strip sits under the horizon line; the elapsed part of the line is solid white, the rest 55% white, with ticks every three hours. Each event is a member-colour mark on the line; upcoming events also float as white pills (two staggered rows) joined to their mark by a thin white stem. The sun is a warm radial disc with a soft halo at now; after dark it becomes a pale moon, pills turn dusk navy, and stems dim. On phone the band is compact and shows marks only.

## Do's and Don'ts

### Do:
- **Do** open every home view with the live sky band and keep its gradient tied to the true time of day.
- **Do** keep apricot for now, the active person, and time pressure; use the now ring (3px apricot) to mark today.
- **Do** identify people with their flora colour on faces, dots, marks and tints, and pair kid-facing items with an icon or emoji avatar so pre-readers can follow.
- **Do** use one field-lift shadow on foam fields over sea-mist ground, with hairlines only between rows.
- **Do** set every time in tabular numerals and keep headings at 650-750 weight in the one rounded face.
- **Do** swap to the night palette after dark rather than lowering opacity.
- **Do** keep touch targets at least 48px and honour safe-area insets.

### Don't:
- **Don't** build white cards over a colour-coded agenda grid; that is the category default this system replaces.
- **Don't** add borders around fields or stack heavier shadows for emphasis; use tone or a ring.
- **Don't** use flora colours for chrome, headings or decoration.
- **Don't** introduce a second display face, or use monospace anywhere but codes to be typed.
- **Don't** add uppercase tracked labels or small category tags above headings.
- **Don't** put bright white or saturated fields on screen at night.
