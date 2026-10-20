---
version: 1
name: RAOTA-app
description: |
  Design system for the RAOTA iOS app, built on the Pinterest DESIGN.md (`npx getdesign add pinterest`) as its skeleton.
  Food photos lead the screen; the chrome recedes into warm gray and white. Red is used only for the one primary action on a screen and the 완식 (bowl-finished) stamp.
  On top of that sit four RAOTA-only marks: soup color, taste fingerprint, meal ticket with the 완식 stamp, and the bowl appraisal.
  Original copy and approved screen mockups: scratch/ramen-objects-prototype/pinterest-DESIGN.md, pin.html (local only).

colors:
  primary: "#E60000"          # RAOTA Red, used instead of Pinterest's #E60023
  primary-pressed: "#CC0000"
  on-primary: "#FFFFFF"
  ink: "#000000"
  on-ink: "#FFFFFF"
  selected: "#000000"          # selected chips, tabs, score cells
  on-selected: "#FFFFFF"
  photo-pill: "#FFFFFF"        # pill laid over a photo
  on-photo-pill: "#000000"
  open: "#1F9D55"              # "open now" dot
  body: "#33332E"
  mute: "#62625B"
  ash: "#91918C"               # text input border
  stone: "#C8C8C1"
  hairline: "#DADAD3"
  secondary-bg: "#E5E5E0"
  secondary-pressed: "#C8C8C1"
  canvas: "#FFFFFF"
  surface-card: "#F6F6F3"
  surface-dark: "#262622"
  focus: "#435EE5"
  error: "#9E0A0A"
  success-deep: "#103C25"
  success-pale: "#C7F0DA"

colors-dark:
  ink: "#FFFFFF"
  on-ink: "#000000"
  selected: "#5C5C55"          # a white surface glares in dark mode, so a light gray instead
  on-selected: "#FFFFFF"
  photo-pill: "rgba(18,18,17,0.88)"
  on-photo-pill: "#FFFFFF"
  open: "#3DD68C"
  body: "#E5E5E0"
  mute: "#A8A8A0"
  hairline: "#33332F"
  secondary-bg: "#33332F"
  secondary-pressed: "#4A4A44"
  canvas: "#121211"
  surface-card: "#22221F"
  surface-dark: "#3A3A35"
  focus: "#7B93F2"

typography:              # Pretendard (400 · 500 · 600 · 700) instead of Pin Sans
  heading-xl:   { fontSize: 28, fontWeight: 700, lineHeight: 34, letterSpacing: -1.2 }   # typography.headline
  heading-lg:   { fontSize: 22, fontWeight: 600, lineHeight: 28 }                        # typography.screenTitle
  heading-md:   { fontSize: 18, fontWeight: 600, lineHeight: 24 }                        # typography.sectionTitle
  nav-title:    { fontSize: 17, fontWeight: 600, lineHeight: 22 }                        # typography.navTitle
  body-md:      { fontSize: 16, fontWeight: 400, lineHeight: 22 }                        # typography.body
  body-strong:  { fontSize: 16, fontWeight: 600, lineHeight: 22 }                        # typography.bodyStrong · cardTitle
  body-sm:      { fontSize: 14, fontWeight: 400, lineHeight: 20 }                        # typography.secondary
  button-md:    { fontSize: 14, fontWeight: 700, lineHeight: 18 }                        # typography.button
  caption-md:   { fontSize: 12, fontWeight: 500, lineHeight: 18 }                        # typography.meta
  counter:      { fontSize: 34, fontWeight: 700, lineHeight: 40, letterSpacing: -1.2 }   # one place: record completion

rounded:
  md: 16     # radii.sm — buttons, inputs, cards, photos, thumbnails
  lg: 32     # radii.lg — large cards, large photos, bottom sheets, dialogs
  full: 9999 # radii.pill — chips, search bar, icon buttons, avatars, pills on photos

spacing:
  xxs: 4
  xs: 6
  sm: 8      # gap between cells in the photo grid (spacing.grid)
  md: 12
  lg: 16     # screen side margin (spacing.gutter)
  xl: 24
  xxl: 32    # between major sections (spacing.section)

components:
  button-primary:     { backgroundColor: primary, textColor: on-primary, typography: button-md, rounded: md, height: 44 }
  button-secondary:   { backgroundColor: secondary-bg, textColor: ink, typography: button-md, rounded: md, height: 44 }
  button-tertiary:    { backgroundColor: transparent, textColor: ink, typography: button-md, rounded: md }
  button-disabled:    { backgroundColor: surface-card, textColor: mute, rounded: md }
  button-icon-circular: { backgroundColor: surface-card, textColor: ink, rounded: full, size: 44 }
  button-pill-on-image: { backgroundColor: canvas, textColor: ink, typography: button-md, rounded: full }
  search-bar:         { backgroundColor: surface-card, textColor: ink, typography: body-md, rounded: full, height: 48 }
  text-input:         { backgroundColor: canvas, border: "1 ash", typography: body-md, rounded: md, height: 48 }
  filter-chip:        { backgroundColor: surface-card, textColor: ink, typography: button-md, rounded: full, height: 40, padding: "0 16" }
  filter-chip-active: { backgroundColor: selected, textColor: on-selected }
  pin-card:           { backgroundColor: surface-card, rounded: md, padding: 0 }
  pin-card-large:     { backgroundColor: surface-card, rounded: lg, padding: 0 }
  pin-overlay-pill:   { backgroundColor: photo-pill, textColor: on-photo-pill, typography: caption-md bold, rounded: full, padding: "6 10" }
  feature-card-soft:  { backgroundColor: surface-card, rounded: lg, padding: 20 }
  modal-card:         { backgroundColor: canvas, rounded: lg, shadow: "0 4 16 rgba(0,0,0,.16)" }
  tab-bar:            { backgroundColor: canvas, border-top: "1 hairline", active: ink, inactive: mute }
---

# RAOTA App Design System

> **Last updated**: 2026.10.19
> **Tokens**: `src/theme/index.ts` · **Components**: `src/components/ui/index.tsx` · **Semantic colors**: `docs/RAOTA_COLORS.md`

UI copy quoted in this document is the exact Korean text shown in the app; an English gloss follows in parentheses where it helps.

## Overview

We take one Pinterest principle as is: **never cover the photo.** The chrome recedes into white (`canvas`) and warm gray (`surface-card`), and the ramen photo carries the weight of the screen. The photo is the card. It is cropped at 16pt with no inner padding; the name and details go below the photo, and markers such as the ramen type go in a pill on top of the photo (`photo-pill`).

There are only three shape words: **16pt** (almost everything), **32pt** (large cards, large photos, sheets), and **pill** (chips, search bar, icon buttons). No sharp corners, no in-between radii, no shadows. Only floating layers (bottom sheets, dialogs, cards over the map) get a soft 16pt ambient shadow.

The previous design (neo-brutalism: off-white background, 2pt ink outlines, hard unblurred shadows, soy-sauce-colored signboards) was replaced on 2026.10.16 because another service uses the same look.

## RAOTA-only marks

Things Pinterest does not have and only RAOTA has. These four separate RAOTA from "an app that looks like Pinterest".

| Mark | Where | Rule |
|---|---|---|
| **Soup color** | Per-type bars and their legend, bowl appraisal and bowl-filling animation, AI soup picker tiles | `soupColorOf(type)` + 1pt `colors.soupEdge` border. Use it only where the color explains what a bar, cell, or bowl means. Never add a decorative dot next to a ramen type name (chips, pills on photos, and list rows use text only; user decision 2026.10.18) |
| **Taste fingerprint** | Ramen log detail (one person's record) | `TasteFingerprint` (`src/components/TasteFingerprint.tsx`). One five-axis pentagon: a gray outer line plus three inner rings that get lighter toward the center; the data is a 16% fill plus a 2pt line in the satisfaction axis color (`tasteAxis.satisfaction`). Axis name and value sit in gray outside each vertex; every axis with the top score is in the same blue, bold (equal scores always get the same color, so ties are all highlighted; user decision 2026.10.20). A score of 1 is 1/5 of the board, so the shape never collapses to a point. Never use a bar with a knob that looks like a slider |
| **This shop's taste** | Shop detail (many people's records) | `ShopTasteCard` + `shopTasteSummaryOf` (`src/domain/shopTaste.ts`). Not a pentagon, so it doesn't repeat the log detail (user decision 2026.10.20). One large sentence built from where most public logs lean — "{broth}에 {noodle}, {closing}" with the two leanings in blue — then 만족도 average and four chips with the share of logs behind each word ("#진한 육수 65%", "#단단한 면", "#토핑 …", "#또 갈래요 …"). Words come from fixed rules (score ≥ 3.5 high, ≤ 2.5 low, else middle), never generated text. It rises in once when the card scrolls into view |
| **Meal ticket and 완식 stamp** | AI ticket issuing and result, record completion | The only moment in the app where a physical "object" appears. A gray ticket with notches on both sides and a dashed tear line, plus a red-outlined stamp |
| **Bowl appraisal** | My, report loading (bowl filling) | Stacks every bowl eaten as soup-colored bowls or dots |

## Colors

- **One red per screen.** One primary button and the record-completion stamp. Selected states (chips, tabs, score cells) use a `selected` surface with `onSelected` text. The one exception is the record button in the center of the tab bar: it is the app-wide entry to recording and sits in the same place on every screen, so it is always red (user decision, 2026.10.17). Inside the screen there is still only one red.
- **The ramen log calendar (contribution grid)** is the second exception. It colors the number of bowls eaten per day, not the ramen type, in four `ramenHeat` steps (1 · 2 · 3 · 4+ bowls), so RAOTA red goes from light to deep. The legend is a single row: "적음 □■■■■ 많음" ("less … more"; user decision, 2026.10.19). It shows a quantity, not an action, so it does not conflict with the one-action rule.
- **Open now** is shown with an `open` green dot (plus text). It is green in both modes.
- **Text color**: headings `ink`, body `body` (`inkSub`), secondary `mute` (`textMuted`). Build hierarchy with weight and size, not color.
- **Surfaces**: background `canvas`; cards, chips, search bar `surface-card` (`canvasSoft`); secondary buttons `secondary-bg`.
- **Lines**: list dividers `hairline` (`border`), text inputs `ash` (`outline`). Draw no other lines.
- **Dark mode**: follows the system setting. On iOS, `colors` are `DynamicColorIOS`, so they switch automatically. Selected states use `selected` (a light gray `#5C5C55` in dark mode instead of a white surface), and pills on photos use `photoPill` (nearly black at 88% in dark mode), so white surfaces never glare in dark mode. Never use an `ink` surface for a selected state. `onDark` is only for text on red. When a color must be a string, use `usePalette()`.
- No yellow stickers and no soy-sauce-colored signboards.

## Typography

One family, Pretendard, weights 400 · 500 · 600 · 700. 12pt minimum, 700 maximum. Only large headings (`headline`, `counter`) use -1.2 letter spacing.

- Tab screen titles and flow questions use `headline` (28/700), the largest name on a screen uses `screenTitle` (22/600), and section titles use `sectionTitle` (18/600).
- Button and chip labels use `button` (14/700). Body text is 16, secondary descriptions 14, metadata 12.

## Layout

- Screen side margin 16pt (`spacing.gutter`), 32pt between major sections (`spacing.section`); the space above a heading is larger than the space below it.
- **Photo grid (masonry)**: the home feed and the lounge use two columns with 8pt between cells (`spacing.grid`) and varying photo heights.
- Bottom sticky action bar: white background with a 1pt `hairline` on top, and only one red button.

## Elevation & Depth

| Level | Treatment | Used for |
|---|---|---|
| 0 Flat | No border, no shadow | Cards, photos, chips, buttons — almost everything |
| 1 Line | 1pt `hairline` / `ash` | List rows, text inputs |
| 2 Floating layer | `shadows.modal` + 50% black backdrop | Bottom sheets, dialogs, cards and chips over the map |

## Components

- **Button**: primary red / secondary `secondary-bg` / ghost. 16pt radius, height 44 (small) · 48 (medium) · 52 (large), label `button`. When disabled: gray surface, faded text, icon hidden.
- **IconButton**: 44pt circle on a `surface-card` surface (on a photo: a `photoPill` circle with an `onPhotoPill` icon).
- **Chip**: 40pt pill; when selected, `selected` surface with `onSelected` text. Ramen type chips use text only.
- **Sticker**: a pill on a photo (`onImage` → `photoPill`) or a gray pill. 12pt bold.
- **Card**: `surface-card`, 16pt radius (32pt for large cards), no border. Never put a card inside a card.
- **Text input**: `canvas` surface with a 1pt `ash` border, 16pt radius, 48pt high. The search bar is a 48pt `surface-card` pill.
- **ScoreSegment**: five pills for 1–5; the selected one uses `selected`.
- **BottomSheet / ConfirmDialog**: `canvas`, 32pt radius, `shadows.modal`, 36×4 `stone` handle.
- **Toast**: `surface-dark` surface with white text, 16pt radius.
- **PhotoViewer**: tapping a photo on the shop or ramen log detail opens it full screen on black. Swipe sideways to page, pinch or double-tap to zoom (up to 4×), drag down or tap close (✕) to dismiss; "n / total" at the top center.
- **Swipe back**: on every stack screen, swiping right from the left edge goes back. Screens whose horizontal scrollers (photo paging, chip rows) reach the left edge of the screen put an `EdgeBackZone` (a 12pt strip, intentionally tap-dead; screens with a top header start it below the header via `top`) at the outermost level so the scroller cannot steal the back swipe.
- **Tab bar**: 홈 (Home) · 지도 (Map) · record (+) · 라운지 (Lounge) · 마이 (My). The center record button has no label: a 64×40pt `primary` shape with a white + in a 16pt-radius rectangle. Tapping it opens the record-method sheet (it is not a screen tab). Its accessibility name is "라멘 기록하기" ("record ramen"). Selected tab `ink`, others `mute`.

## Screens

- **Home**: logo + "RAOTA." + "나의 라멘 취향을 찾는 곳" ("where you find your ramen taste") · on the right "{nickname}님 ›" → a time-of-day greeting ("오늘 아침은 어떤 라멘으로 할까요?", "what ramen will it be this morning?") and this month's record line → AI curator card (`feature-card-soft` + red button) → today's curation as a large photo pin → a row of recommended-shop photo pins → nearby ramen shops → new lounge logs. No search bar and no type chips (search lives in the Map tab).
- **Lounge**: title; one row of chips (the sort chip defaults to "전체 ▾" ("all"); tapping it opens a dropdown with 전체 · 최신순 · 인기순 (all · latest · popular), followed by type chips); 12pt gap; then a two-column photo grid. On photos, show only the type pill and the photo count. Logs without photos are quote cells sized to their text.
- **Shop detail**: 32pt-radius large photo (thumbnails at the bottom left when there are several) → icon row (want to go · share · more) → name and details → intro and features → this shop's taste → shortcuts → info rows → sticky "먹은 라멘 기록하기" ("record the ramen I ate") at the bottom (the one red).
- **My**: centered round avatar, name, bowl and shop counts, underlined tabs, bowl appraisal, calendar (contribution grid where red deepens with the number of bowls per day), recent logs. Recent logs, visited shops, and want-to-go each scroll inside a frame at most 10 rows tall and load more at the bottom of the frame.
- **Settings**: a plain list with dividers. Log out, delete account, and app version are grouped at the bottom of the screen.

## Motion

System transitions are the default; custom motion follows the rules below. Mockup: `scratch/ramen-objects-prototype/motion.html` (local only).

- **General**: keep shapes and positions fixed and animate only opacity, translation, scale transforms, and color (the layout must never shift). The default curve is ease-out `bezier(0.22, 1, 0.36, 1)`. With Reduce Motion on, everything jumps straight to its final state.
- **Response at the touch point (0.2–0.45s)**: the want-to-go heart pops and a faint ring spreads · the like heart pops and the count rolls over by one · chips, score cells, and AI options cross-fade color over 0.2s and scale to 97% while pressed · an AI chosen-condition cell settles into place when filled and its value rises from below · photos show a passing sheen while loading and fade in when they arrive.
- **Once, on first view**: on the ramen log detail, the taste fingerprint's blue area grows from the center on open and the axis names appear one by one (the highest axes turn blue last) · on the shop detail, "this shop's taste" sentence rises in and its chips follow one by one the moment the card scrolls into view (`play`) · in the lounge, only newly loaded pins rise 14pt in sequence · on My, bowl appraisal dots fill in eating order, the bowl count counts up from 0, and the level bar fills.
- **Transitions**: in the photo viewer, the frame of the tapped photo grows in place to fill the screen (at the photo's aspect ratio) and shrinks back on close. It starts only after the photo is drawn, and the paging list is attached only after the transition ends · the tab bar + rotates 45° into ✕ and the record-method rows appear in sequence. Map pins and the map card do not animate (user decision, 2026.10.19).
- **Existing motion**: AI ticket issuing (condition chips light up in turn and the ticket rises), bowl filling (soup fills and groups by type), the 완식 stamp (stamped once), monthly bars (unfold from the left).

## Do's and Don'ts

### Do
- One red per screen (the tab bar record button is the exception). Other actions are secondary or ghost.
- Crop photos at 16pt (32pt when large) with no inner padding, and place markers in pills on the photo (`photoPill`).
- Invert selected states with `selected`.
- Always pair semantic colors (soup, taste fingerprint) with text.
- Before making a new component, first check whether a photo pin + 16pt + gray surface can express it.

### Don't
- Borders on cards or buttons, hard unblurred shadows, in-between radii (6 · 8 · 12pt).
- Yellow stickers, large soy-sauce-colored sections, red selected states.
- Text heavier than 700 or smaller than 12pt.
- Hex values written directly in screens (dark mode breaks). Only provider brand colors (such as Kakao yellow) are exempt.
- Showing unselected values as blanks like "—". If there is nothing, hide it.
