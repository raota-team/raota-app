---
version: 1
name: RAOTA-app
description: |
  Design system for the RAOTA iOS app, built on the Pinterest DESIGN.md (`npx getdesign add pinterest`) as its skeleton.
  Food photos lead the screen; the chrome recedes into warm gray and white. Red is used only for the one primary action on a screen and the pen circles on the record-completion taste sheet.
  On top of that sit four RAOTA-only marks: soup color, taste fingerprint, meal ticket and taste sheet, and the bowl appraisal.
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
| **Soup color** | Per-type bars and their legend, bowl appraisal and bowl-filling animation, AI ticket-machine soup buttons (a 6pt swatch at the bottom) | `soupColorOf(type)` + 1pt `colors.soupEdge` border. Use it only where the color explains what a bar, cell, or bowl means. Never add a decorative dot next to a ramen type name (chips, pills on photos, and list rows use text only; user decision 2026.10.18) |
| **Taste fingerprint** | Ramen log detail (one person's record) | `TasteFingerprint` (`src/components/TasteFingerprint.tsx`). One five-axis pentagon: a gray outer line plus three inner rings that get lighter toward the center; the data is a 16% fill plus a 2pt line in the satisfaction axis color (`tasteAxis.satisfaction`). Axis name and value sit in gray outside each vertex. Only the quality axes (만족도 · 토핑 · 재방문) can turn blue: the one(s) with the top score among them are blue and bold, ties all highlighted. 육수 농도 and 면 삶기 describe a style, not a grade (a light broth is not worse), so they always stay gray (user decision 2026.10.20). A score of 1 is 1/5 of the board, so the shape never collapses to a point. Never use a bar with a knob that looks like a slider |
| **This shop's taste** | Shop detail (many people's records) | `ShopTasteCard` + `shopTasteSummaryOf` (`src/domain/shopTaste.ts`). Not a pentagon, so it doesn't repeat the log detail (user decision 2026.10.20). It answers "would people go back?" first: a 96pt ring in the taste blue, centered in the card, showing the share of public logs that chose 자주 감 ("또 갈래요"), with "{n}명 중 {m}명이 또 가고 싶대요" and the other revisit answers centered below it. The ring and percentage appear only from `SHOP_TASTE_RATIO_MIN_LOGS` (5) rated public logs; below that the card shows just the head-count sentence ("{n}명 모두 또 가고 싶대요") and a muted "기록이 5개 이상 쌓이면 비율로 보여드려요", so two logs never read as "100%". Below, four cells split by hairlines (not nested cards): 많이 먹은 메뉴 · 육수 · 면 · 토핑. Satisfaction is intentionally not shown here. Words come from fixed rules (score ≥ 3.5 high, ≤ 2.5 low, else middle; most logs win), never generated text |
| **Meal ticket and taste sheet** | AI curator steps 1–3 (ticket machine), AI ticket issuing, result and today's drawn tickets, record form (appraisal ticket), record completion (taste sheet) | The only places in the app where a physical "object" appears. Steps 1–3 of the AI curator are a ramen-shop ticket machine (user decision 2026.10.20, option C, no button numbers): a `canvasSoft` 32pt panel headed "RAOTA 식권 · {n}단계", `canvas` 16pt buttons with a 2pt `secondary` lip under them (a surface, not a border), a chosen button turns `selected` and gets a 24pt `canvas` circle with an `ink` check at the top right (user decision 2026.10.20, chosen over a blue lamp), and a decorative slot row at the bottom ("{choice} 골랐어요"). Ticket issuing (user decision 2026.10.26, option B "식권"): a 12pt `ink` pill slot, slightly wider than the ticket, and a small colored-paper meal ticket that drops out of it. The paper is the recommended shop's soup color mixed 30% into white (`ticketPaperOf`), the way real ticket machines print each menu on its own colored paper; it stays light in dark mode, so its text and tear line use the fixed `ticketInk`. Centered "오늘의 한 그릇", shop name and "{type} · {distance}", then an SVG dashed tear line and a foot row "RAOTA 식권" · "{YY.MM.DD} · 1매" (`MealTicketFoot`). 8pt corners, no notches, no stamp. Every drawn ticket uses the same paper (user decision 2026.10.26): the result card is that ticket with the shop photo on top (type pill on the photo, description in `ticketInk.muted` under the name), and each row of "오늘 뽑은 식권" (`TodayTicketsSheet`) is a small paper ticket colored by the ticket's chosen soup (or the first shop's type), with a 56pt photo, shop name and conditions, and a dashed tail stub with "No.{n}" and the issue time. The chosen-condition cells above show only their name until filled, never "—". The record form's "RAOTA 감정서" keeps the gray notched ticket (see Screens: Record form). Record completion is a "취향 기록지" (user decision 2026.10.26, after Ichiran's order sheet; it replaced the ticket and 완식 stamp): a `canvasSoft` 16pt sheet with hairline rows: header "취향 기록지" · "No.{nnnn}", 가게 / 메뉴 ({type}) / 날짜 rows with the log photo as a 64pt thumbnail on the right when there is one, then one row per score axis with low label · 1 2 3 4 5 · high label, and 재방문 의사 with its three answers from low to high. The chosen value of each row is ringed by a hand-drawn red (`brand`) pen circle; a legacy log without scores shows only the 재방문 row |
| **Bowl appraisal** | Report drawing (bowls stack into towers), report story first card (the 15 most recent bowls as dots) | Stacks every bowl eaten as soup-colored bowls or dots. On the dark `deep` card the dot edge is `onDark` at 30% instead of `soupEdge`, so light soups never vanish into the card. Not on My: the per-type photo boards there already say the same thing (user decision 2026.10.20). Drawing the report (user decision 2026.10.20, option B; mockup `scratch/ramen-objects-prototype/bowl-b.html`): bowls drop one by one in the order they were eaten (oldest first) into one tower per type above a hairline baseline, accelerating so 43 bowls take about 3s; each lands with a slight squash and the tower below nudges 1pt; a big counter "{k}그릇" and the period "{first month} ~ {month}" tick with each landing; a tower's count appears when it is complete. Then the other towers dim to 40%, the winning tower's count turns `brandText` (the screen's one red), the tower lifts 4pt and steam rises from its top bowl, with one light haptic; then "{identity} · {n}그릇 중 {type} {count}그릇 · {pct}%". Falling bowls are clipped to the tower area. Tower spacing compresses so the tallest always fits; up to 60 bowls are drawn exactly, beyond that a largest-remainder sample with "그릇 1개 ≈ n그릇". Reduce Motion shows the finished towers at once (no steam, no haptic); VoiceOver hears only the start and the result. |

## Colors

- **One red per screen.** One primary button and the pen circles on the record-completion taste sheet. Selected states (chips, tabs, score cells) use a `selected` surface with `onSelected` text. The one exception is the record button in the center of the tab bar: it is the app-wide entry to recording and sits in the same place on every screen, so it is always red (user decision, 2026.10.17). Inside the screen there is still only one red.
- **The ramen log calendar (contribution grid)** is the second exception. It colors the number of bowls eaten per day, not the ramen type, in four `ramenHeat` steps (1 · 2 · 3 · 4+ bowls), so RAOTA red goes from light to deep. The legend is a single row: "적음 □■■■■ 많음" ("less … more"; user decision, 2026.10.19). It shows a quantity, not an action, so it does not conflict with the one-action rule.
- **The selected map pin** is the third exception: the chosen shop's pin is RAOTA red so it stands out among the black pins at a glance outdoors, and its name label under the circle is the same red with white text, so circle and label read as one marker (user decision 2026.10.23; it was a `selected` black label before). It marks "where you are looking", there is only one at a time, and the screen's action lives in the quick-view card, so it does not compete with a red button (user decision 2026.10.20). The selected shop is never folded into a cluster; it is always drawn on its own, above the other pins.
- **Map selection** (user decision 2026.10.21): the map opens at the user's location with nothing selected and no card. Tapping a pin selects it (red pin + name label) and shows the quick-view card with a ✕ at its top right ("선택 해제"); the ✕, a tap on empty map, or a search/filter that hides the shop clears the selection. The ✕ sits beside the card button, not inside it, so VoiceOver can reach it. The "조건에 맞는 라멘집이 없어요" card appears only when no shop matches (never while shops are loading).
- **Map provider** (user decision 2026.10.24): the map tab is NAVER Maps (`@mj-studio/react-native-naver-map`) on both iOS and Android, chosen for Korean map data (stations, lines, street names) and so Android shows the same map instead of Google Maps. It uses the `raota-quiet` custom style made in the NAVER Style Editor (`RAOTA_STYLE_ID` in `app/native/map.tsx`): 32 symbol types (shops, restaurants, banks, convenience, facilities, apartments, building and road numbers, bus stops) are off, roads, zones and land are warm gray, and subway lines and stations, neighborhood names, parks and street names stay. Editing and republishing the style in the editor changes the app without a new build; the app needs the editor's "My Style ID" (shown under "스타일 적용하기" after publishing), not the ID in the editor URL. The NAVER logo must stay visible, so it moves above the quick-view card while a card is shown. The Maps client ID (`app.json`, `@mj-studio/react-native-naver-map` plugin) belongs to the NAVER Cloud "Maps" product (not the closed AI·NAVER API one) and is registered for `com.raota.app` on iOS and Android. Map markers cannot carry accessibility labels, so VoiceOver users reach shops through the list view ("목록으로 보기").
- **Map loading** (2026.10.23): the map reads every shop in one request (about 540, 1–2s) without the user's position, so getting a location never refetches it; distance and distance sorting are computed on the device. The tabs prefetch this request once the app is hydrated, so the map tab usually opens with its pins ready. Pin circles are pre-drawn images (`assets/images/map-pin.png`, `map-pin-selected.png`: 32pt circle with the white logo in a 44pt tap area), so the map draws them directly; only the selected shop's red name label and the count pills are views, and they hold text only because NAVER Maps does not capture images inside marker views. The selected name label is measured off-screen first and its marker is exactly that wide, because a marker takes taps across its whole transparent box and a wide box swallowed taps on the neighboring pills. Clusters are computed over all shops and only when the zoom (region span) changes, so a pan never regroups pins (2026.10.24: clustering only the visible shops regrouped them at every stop, so almost every marker was removed and redrawn and panning felt choppy). Only clusters inside the visible region plus half a screen on each side become markers; new ones attach when a pan or zoom settles. A pill's marker identity is its first shop, so a count change redraws just the number.
- **Map clusters** (user decision 2026.10.23): pins that would sit closer than 56pt on screen merge into a black count pill (`calculateMapClusters`, `src/domain/map.ts`), at every zoom level, so zooming in one step never bursts clusters into a pile of overlapping pins. NAVER's built-in clustering is not used because its cluster marker cannot be restyled (orange circles). Shops are walked in ID order and join the first group whose first pin is within 56pt (no chaining); a group is drawn at its first pin, so pills never overlap each other. At a latitude span of 0.004 or less (street level) nothing merges, so shops in one building stay selectable. The pill grows for three-digit counts. Single pins and count pills share the screen on purpose: a shop with room around it shows itself, only crowded spots become a number. Tapping a pill zooms until all of that group's shops fit the area below the search header (and above the shop card when one is open) with a 56pt margin (`regionToSpread`), at least 2× and never past street level; the group splits that far, and a very dense spot leaves smaller numbers that split fully on the next tap. Zooming in further to split everything at once was tried and rejected: at 3× five of a 13-shop Hongdae group left the screen. Camera moves take `CAMERA_MS` (220ms, ease-out), which NAVER Maps honors directly. NAVER's `Region` is anchored at the south-west corner while the map screen and `src/domain/map.ts` use the center, so `app/native/map.tsx` converts at the boundary (`fromNaverRegion`, `toNaverRegion`).
- **Open now** is shown with an `open` green dot (plus text). It is green in both modes.
- **Text color**: headings `ink`, body `body` (`inkSub`), secondary `mute` (`textMuted`). Build hierarchy with weight and size, not color.
- **Surfaces**: background `canvas`; cards, chips, search bar `surface-card` (`canvasSoft`); secondary buttons `secondary-bg`.
- **Lines**: list dividers `hairline` (`border`), text inputs `ash` (`outline`). Draw no other lines.
- **Dark mode**: follows the system setting. On iOS, `colors` are `DynamicColorIOS`, so they switch automatically. Selected states use `selected` (a light gray `#73736C` in dark mode instead of a white surface; at least 3:1 against unselected surfaces and 4.5:1 for white text on it), and pills on photos use `photoPill` (nearly black at 88% in dark mode), so white surfaces never glare in dark mode. The warm charcoal `deep` is `#4F4F48` in dark mode so it is the lightest card in a stack. Never use an `ink` surface for a selected state. `onDark` is only for text on red and on the `deep` surface (toast, report story first card, My report deck). Red text uses `brandText` (`#E60000` light, `#FF5A5A` dark, 6.1:1 on the dark canvas); `brand` is for red surfaces only (and for the taste sheet's red pen circles, which read on its gray sheet in both modes). The AI meal ticket's colored paper stays light in dark mode and uses `ticketInk` for its text. Switches show "on" in the `open` green. When a color must be a string, use `usePalette()`.
- No yellow stickers and no soy-sauce-colored signboards.

## Typography

One family, Pretendard, weights 400 · 500 · 600 · 700. 12pt minimum, 700 maximum. Only large headings (`headline`, `counter`) use -1.2 letter spacing.

- Tab screen titles and flow questions use `headline` (28/700), the largest name on a screen uses `screenTitle` (22/600), and section titles use `sectionTitle` (18/600).
- Button and chip labels use `button` (14/700). Body text is 16, secondary descriptions 14, metadata 12.

## Layout

- Screen side margin 16pt (`spacing.gutter`), 32pt between major sections (`spacing.section`); the space above a heading is larger than the space below it.
- **Page end**: when scrolled to the bottom, the last content ends 32pt (`spacing.x8`) above whatever sits at the bottom (tab bar, sticky bar, comment box, or the home-indicator safe area). Apply it once: never stack the scroll padding and the last section's padding.
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
- **BottomSheet / ConfirmDialog**: `canvas`, 32pt radius, `shadows.modal`, 36×4 `stone` handle. The handle and title area can be dragged down to close (past 25% of the height or a flick); the content area does not drag, so it never fights scrolling. Sheets that must not close (saving in progress) spring back.
- **Toast**: `surface-dark` surface with white text, 16pt radius. VoiceOver reads the message when it appears. It closes after 2.5s, except: with a screen reader on and an action (되돌리기), it stays until used or closed; with only one of those, it stays at least 10s. Under a screen reader it shows a small ✕ ("알림 닫기").
- **Load errors**: every screen that reads from the server offers "다시 불러오기" on a failed first load (empty state button, or a text action inside the map notice). Until the data hooks expose `refetch`, it remounts the screen body so only the failed requests run again. In local-storage mode there is nothing to retry, so the button is not shown.
- **Photo sizes**: photos on `images.raota.net` are never downloaded at their original size (often 1–3MB) for a frame. `sizedImageUri` (`src/api/imageSize.ts`) asks Cloudflare image transformations (`/cdn-cgi/image/`, enabled on the raota.net zone 2026.10.23) for the frame's longest side at device pixels, rounded up to 320 · 640 · 1080px; `ResilientUriImage` does this from its measured frame, and direct `Image` uses pass their frame size. Device photos and other hosts are left as they are. Only `PhotoViewer` loads the original, because it zooms up to 4×.
- **PhotoViewer**: tapping a photo on the shop or ramen log detail opens it full screen on black. Swipe sideways to page, pinch or double-tap to zoom (up to 4×), drag down or tap close (✕) to dismiss; "n / total" at the top center.
- **Swipe back**: like the browser back button, swiping right anywhere on a stack screen goes back (`fullScreenGestureEnabled` on both stacks; native on iOS 26+). Horizontal scrollers (story cards, photo paging, chip rows) keep their own swipes, except that a right swipe while the scroller is already at its first page goes back: `modules/back-swipe` (native) stops the scroller's pan from starting in exactly that case, so the navigation's back gesture receives it (user decision 2026.10.20). Screens with unsaved input (record/new) still ask before leaving. `EdgeBackZone` stays as a 12pt edge strip for older iOS edge swipes.
- **Tab bar**: 홈 (Home) · 지도 (Map) · record (+) · 라운지 (Lounge) · 마이 (My). The center record button has no label: a 64×40pt `primary` shape with a white + in a 16pt-radius rectangle. Tapping it opens the record-method sheet (it is not a screen tab). Its accessibility name is "라멘 기록하기" ("record ramen"). Selected tab `ink`, others `mute`.

## Screens

- **Home**: logo + "RAOTA." + "나의 라멘 취향을 찾는 곳" ("where you find your ramen taste") · on the right "{nickname}님 ›" → a time-of-day greeting ("오늘 아침은 어떤 라멘으로 할까요?", "what ramen will it be this morning?") and this month's record line → AI curator card (`feature-card-soft` + red button) → today's curation as a large photo pin → a row of recommended-shop photo pins → nearby ramen shops → new lounge logs. No search bar and no type chips (search lives in the Map tab).
- **Lounge**: title; one row of chips (the sort chip defaults to "최신순 ▾" and opens 최신순 · 인기순; it looks selected only when not on the default; then type chips); 12pt gap; then a two-column photo grid, virtualized (`@shopify/flash-list` masonry, 8pt between columns, each card goes to the shorter column by measured height). No search button in the lounge header. On photos, show only the type pill and the photo count. Logs without photos are quote cells sized to their text.
- **Shop detail**: 32pt-radius large photo (thumbnails at the bottom left when there are several) → icon row (want to go · share · more) → name and details → intro and features → this shop's taste → shortcuts → info rows → sticky "먹은 라멘 기록하기" ("record the ramen I ate") at the bottom (the one red).
- **My**: centered round avatar (its edit badge is a pencil; the gear means only Settings), name, bowl and shop counts, level bar, underlined tabs, the report card, per-type photo boards, calendar (contribution grid where red deepens with the number of bowls per day), recent logs. Every number on My, and the level, comes from the bowls ledger (`bowls.length`), the same source as the report, so one screen never shows two totals. The report card is the story's first card peeking out of a deck (user decision 2026.10.20, option B): the warm charcoal `deep` card with `onDark` text "{identity} · 지금까지", "{n}그릇을 기록했어요", "{m}곳을 다녔어요", two blank cards (`secondaryPressed`, then `secondary`, no borders) stepping out behind it on the right, and "{pages}장 이야기 · 넘겨 보기 →" below; the whole deck opens the report. No soup dots here (the per-type photo boards say it). Empty accounts get the identity description and "첫 그릇 기록하기". Nothing on My animates on entry; the count and level bar are drawn at their values. Recent logs, visited shops, and want-to-go each scroll inside a frame at most 10 rows tall and load more at the bottom of the frame.
- **Taste report**: "한 장씩 넘기는 이야기" (`TasteStory`, `src/components/TasteStory.tsx`; user decision 2026.10.20). A horizontally paged row of 32pt cards at full content width, one large sentence each, and each card carries one real-data picture so it is not an empty panel: how many bowls (the warm charcoal `deep` card with `onDark` text and recent soup dots; pure black `ink` felt too heavy on the warm gray screen and turned into a glaring white card in dark mode, user feedback 2026.10.20) → the most-eaten soup (a knobless share strip of every soup in soup colors) → the taste ("{broth}에 {noodle}", same lean rule as this shop's taste, words in blue; below it the 육수 and 면 averages as five 8pt dots filled in blue plus the number) → the regular shop (its photo fills the right 40% of the card edge to edge, clipped by the card corners; tap opens it). All cards share the tallest card's height (168pt minimum) so paging never shifts the page. Under the cards one fixed-height row: dots on the left (inactive dots `outline`, current a 16×6 pill) and "{p} / {n} · 넘겨 보기 →" on the right, the same cue as the My deck; tapping it advances one card (no slide with Reduce Motion), and on the last card it reads just "{n} / {n}". No slider-like bars. Below: per-type bars, frequent shops, the next bowl to try, and the page ends on a secondary "리포트 다시 뽑기" that replays the bowl filling from the start. Sharing lives only in the header (never a second share button at the bottom; user decision 2026.10.20). Empty accounts keep the identity cover card. The monthly archive compares "지난달과 달라진 종류", leaves unchanged cells empty instead of "—", and hides the table for a month with no typed bowls.
- **Settings**: a plain list with dividers. Log out, delete account, and app version are grouped at the bottom of the screen.
- **Launch screen** (user decision 2026.10.26): the native splash and the JS `LaunchCover` show the same square image (bowl logo + "RAOTA." wordmark, `assets/images/splash.png` / `splash-dark.png`) at 200pt in the center, so the hand-off doesn't move. Home renders underneath; the cover fades out (250ms, instant with reduce motion) once home's shop list and today's curation have loaded, never before 1s after launch, and at most 2s after the store and saved login are ready. A deep link into a flow screen doesn't wait for home. Keep `imageWidth` in `app.json` and `SPLASH_IMAGE_SIZE` equal.
- **Taste report release switch** (user decision 2026.10.26): the report ships hidden. `TASTE_REPORT_ENABLED` (`src/features.ts`) is on only when `EXPO_PUBLIC_FEATURE_TASTE_REPORT=true`, so a release build that leaves it empty stays hidden. Off removes only the ways in: My's report card and "월별 취향 변화" entry, the completion screen's "취향 리포트 보기" (홈으로 becomes the primary), any `/taste` address including deep links and notifications (the flows layout sends it to home), and the monthly-report reminder (only the 7-day reminder is scheduled). Copy that promised a report (onboarding, guest My, record form, reminder prompts, Settings) switches to wording without it. The screens, calculations, and the AI curator's use of taste stay in main unchanged.
- **AI curator**: four steps (ticket machine for 1–3, free text + quick prompts for 4) → ticket issuing → result. Ranking uses the user's own taste (a report built from their bowls and 5-axis averages); when it does, "추천에 쓴 조건" adds "내 취향 · 내 기록 {n}그릇의 취향을 반영했어요" (not for guests, empty accounts, or "빠르고 든든한 한 끼", which sorts by distance). The chosen soup is matched by the shop's actual type, and the photo pill, ticket and condition row all use the chosen soup's name. Quick prompts offer only conditions the matcher can check (차슈가 푸짐한 곳 · 지금 영업 중인 곳 · 밥 무료 제공 · 면 무료 리필). "다시 추천받기" keeps the answers and shows the next-ranked shop (wrapping at the end); with a single candidate it reads "조건 바꿔 다시 고르기". On steps 2–4 and during ticket issuing, the back gesture goes back one step instead of leaving. Once today's tickets are used up (remaining 0) the steps cannot be entered (user decision 2026.10.23): the home curator card says "오늘 식권 {n}장을 다 뽑았어요. 내일 다시 채워져요", its button turns gray "뽑은 식권 보기" and opens today's tickets on home (the ticket line under the card hides), and opening the curator directly shows "오늘 식권을 다 뽑았어요" · "식권은 하루 {n}장이에요. 내일 다시 뽑을 수 있어요." with "뽑은 식권 보기". Reopening a drawn ticket and the result of the ticket just drawn still work.
- **Ramen log detail**: on your own log, the ··· menu offers only 삭제 (destructive confirm dialog, then back), and only when the device can really delete it (a log held in the local store). Logs read from the server and your own comments get no menu until the data layer supports deleting and editing them.
- **Record form** ("한 장씩 감정서", user decision 2026.10.23; prototype on the `prototype/record-screen` branch): one question per screen with no scrolling at normal text size (it scrolls only for large text, small screens, or the keyboard). Top to bottom: a 4pt progress bar → the "RAOTA 감정서" gray 32pt ticket (header with the visit date, which opens the calendar; shop photo or the first record photo, shop name with › to change shop, "{type} · {menu}"; tear line; six pill cells 만족 · 육수 · 면 · 토핑 · 재방문 · 감정 that fill with the answer, the current question's cell ringed in `ink`, and a reached cell jumps back to its question) → "{n} / 7" + the question in `screenTitle` → the answers. Seven steps: 무엇을 먹었나요? (menu input + ramen type chips) → the four scores as five full-width 48pt answer rows each (word on the left, number on the right) → 다시 가고 싶나요? (three rows) → 더 남길 감정이 있나요? (선택: taste-tag category tabs 국물 · 면 · 간 · 토핑 with their chips, 기억해둘 점, up to 3 photos, 나만 보기 · 공개). A new record is 공개 by default (user decision 2026.10.23); editing keeps the log's own setting. Picking an answer never advances by itself: the user presses 다음, which goes to the next unanswered question (user decision 2026.10.23). The footer has 이전 and the one red button (다음, or 감정서 발행 / 저장하기 on the last step). Pressing it with something missing goes to that question and turns only that question's hint red. Editing opens on the last step (or the first question a pre-5-axis log never answered).
- **Record shop picker**: modal sheet closed with an ✕ ("닫기"). A filtered-empty nearby list offers "전체 보기" to reset the filter.

## Motion

System transitions are the default; custom motion follows the rules below. Mockup: `scratch/ramen-objects-prototype/motion.html` (local only).

- **General**: keep shapes and positions fixed and animate only opacity, translation, scale transforms, and color (the layout must never shift). The default curve is ease-out `bezier(0.22, 1, 0.36, 1)`. With Reduce Motion on, everything jumps straight to its final state.
- **Response at the touch point (0.2–0.45s)**: the want-to-go heart pops and a faint ring spreads · the like heart pops and the count rolls over by one · chips, score cells, and AI quick prompts cross-fade color over 0.2s and scale to 97% while pressed · AI ticket-machine buttons sink 2pt over their lip while pressed and stay sunk with the check once chosen · an AI chosen-condition cell settles into place when filled and its value rises from below · photos show a passing sheen while loading and fade in when they arrive.
- **Once, on first view**: on the ramen log detail, the taste fingerprint's blue area grows from the center on open and the axis names appear one by one (the highest axes turn blue last) · on the shop detail, the "this shop's taste" ring fills to its share and the text and four cells rise in one by one the moment the card scrolls into view (`play`) · in the lounge, only newly loaded pins rise 14pt in sequence · on the taste report, only the first story card's large sentence rises 6pt and fades in (0.5s); paging itself is not animated beyond the scroll.
- **Transitions**: in the photo viewer, the frame of the tapped photo grows in place to fill the screen (at the photo's aspect ratio) and shrinks back on close. It starts only after the photo is drawn, and the paging list is attached only after the transition ends · the tab bar + rotates 45° into ✕ and the record-method rows appear in sequence. Map pins and the map card do not animate (user decision, 2026.10.19); map camera moves (pin select, cluster zoom, "내 위치로") take 220ms so the map feels quick (`CAMERA_MS`; instant with Reduce Motion).
- **Existing motion**: AI ticket issuing (condition chips light up in turn, the ticket's foot row drops out of the slot first, and the whole ticket drops down once the result is ready), report drawing (bowls stack into per-type towers; see Bowl appraisal), monthly bars (unfold from the left), the record form (each question slides in from the right, or from the left going back; answer rows rise in 30ms apart; a picked row fills with `selected` from the left; a filled ticket cell flips in; the progress bar glides; tag tabs and 나만 보기 · 공개 slide a `selected` thumb), and the taste sheet pen circles (after the 420ms stack transition, each row's circle is drawn in 380ms, top row first, 220ms apart, ending with 재방문; one light haptic fires when the last circle closes; with Reduce Motion the circles are already drawn).

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
