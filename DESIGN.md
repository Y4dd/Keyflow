---
name: Keyflow
description: Synth soloing and comping over funk and soul grooves, played on a MIDI keyboard in a dim room.
colors:
  bin: "#1c1512"
  well: "#120d0b"
  card: "#2a201a"
  card-raised: "#352920"
  rule: "#3d2f26"
  line: "#8a7462"
  kraft: "#c8a271"
  bone: "#f1e8da"
  bone-muted: "#bfb09c"
  key-white: "#efe6d6"
  key-letter: "#6b5a4c"
  funk: "#ff7b2e"
  wobble: "#ff7fae"
  keys: "#7cc4f2"
  round: "#a28bff"
  tines: "#3fcfc0"
  now: "#ffd25a"
  done: "#7fd49b"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0.02em"
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sleeve: "3px"
  card: "4px"
  input: "6px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  button-hover:
    backgroundColor: "{colors.card-raised}"
  button-primary:
    backgroundColor: "{colors.now}"
    textColor: "{colors.bin}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.bone}"
    rounded: "{rounded.card}"
    padding: "36px 24px 24px"
  card-tab:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.bin}"
    typography: "{typography.headline}"
    padding: "4px 14px 1px"
  select:
    backgroundColor: "{colors.card-raised}"
    textColor: "{colors.bone}"
    rounded: "{rounded.input}"
    padding: "6px 10px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  chip-selected:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.bin}"
  step:
    backgroundColor: "{colors.card-raised}"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "5px 16px 5px 5px"
  sticker-now:
    backgroundColor: "{colors.now}"
    textColor: "{colors.bin}"
    size: "30px"
  sticker-done:
    backgroundColor: "{colors.done}"
    textColor: "{colors.bin}"
    size: "30px"
  hint:
    textColor: "{colors.bone}"
    rounded: "{rounded.input}"
    padding: "10px 14px"
---

# Design System: Keyflow

The approved theme is [docs/design/theme.md](docs/design/theme.md) (Crate Dig, chosen 2026-11-25), with its [mood board](docs/design/mood-board.html). This file records what the build ships; where the two differ, this file follows the code (`src/index.css`, `src/ui/`, `src/ui/canvas/keyboard.ts`). A change to the theme is the user's call.

## Overview

**Creative North Star: "Crate Dig"**

A neighbourhood record shop after closing: warm dark wood bins, kraft divider cards lettered in condensed capitals, a few bright price stickers, and the record you are about to play pulled up out of the crate. The app is played in a dim room from a stand's distance, so it is dark only, roomy, and set in text large enough to read from there.

The world lends colour, type, density and one signature move (the lifted sleeve), and nothing else. Controls stay ordinary native web controls styled in the palette; the page stays a plain single column. There are no crate graphics, wood grain or paper textures, no gradients outside sleeve art, and no shadow except the lifted sleeve's floor. Nothing moves while you play except the canvas keyboard.

It must never read as childish or gamified (badges, mascots, confetti, scores), as intimidating pro gear (DAW, rack, bezel, VU meters), or as generic SaaS (floating cards, gradients, a blue button).

**Key Characteristics:**
- Flat walnut-black ground with flat brown cards, each topped by a kraft tab.
- Each sound owns one colour everywhere: sleeve, zone strip, lit keys, its sliders.
- Yellow marks the next thing to do (plus the ON sticker and focus); green marks done.
- Round stickers carry state, and state always shows in shape as well as colour.
- Native controls (buttons, selects, checkboxes, radios, ranges) restyled, never replaced.
- The 61-key canvas keyboard sits full width in a dark well, in one fixed place.

## Colors

A restrained warm-dark ground with a few committed sticker colours; every colour has one job.

### Primary
- **Price-Sticker Yellow** (`now`): the next thing to do. The current setup step's sticker and ring, the primary button on the one card whose step is "now", and the hint box's edge and tint. It has two further fixed jobs: the ON sticker on a chosen sleeve (as on the approved mood board) and every focus outline.

### Secondary
- **Connected Green** (`done`): a done setup step's sticker. Never used as a button or for decoration.

### Tertiary (sound colours)
- **Funk Orange** (`funk`): Funk Lead.
- **Wobble Pink** (`wobble`): Wobble Bass.
- **EP Blue** (`keys`): EP Keys.
- **Round Violet** (`round`): Round Bass, the grooves' bass and the default left sound (P1-T3b).
- **Tine Teal** (`tines`): Warm Tines (P1-T3b, still being auditioned).

Each fills its sleeve art, its zone strip over the keyboard, the keys it lights, and the accent of its sliders (via `--sound` set by `data-sound`). The sleeve art may use one deeper shade of its own colour plus `bone` and `bin` (`src/ui/Sleeve.tsx`).

### Neutral
- **Crate Wood** (`bin`): page ground; also the text on every sticker, tab and the primary button.
- **Keyboard Well** (`well`): the inset behind the canvas keyboard; the dev log.
- **Divider Card** (`card`): every panel.
- **Raised Card** (`card-raised`): selects, button hover, step pills, `kbd` keys.
- **Hairline** (`rule`): decorative rules only (the masthead's bottom edge). Never a control outline.
- **Control Line** (`line`): button, chip and select outlines, dashed "to do" stickers, the scrollbar thumb.
- **Kraft** (`kraft`): divider tabs, the wordmark, text selection.
- **Bone** (`bone`): text; the selected chip's fill; the native accent colour.
- **Faded Bone** (`bone-muted`): secondary text, unselected sleeve names, readout labels.
- **Ivory Key** (`key-white`) and **Key Letter** (`key-letter`): the canvas's idle white keys and the computer-key letters on them. Idle black keys use `card`.

### Named Rules
**The No Red Rule.** There is no red anywhere. A problem (sound failed, MIDI refused) is a yellow hint with one clear next step. Out-of-scale notes are dimmed toward `well`, never red.

**The Next Step Rule.** Yellow means the next step. At most one yellow button and one yellow ring show at a time: a button gets the primary style only on the card whose setup step is "now", and loses it once that step is done. Yellow's only other jobs are the ON sticker, hints and the focus outline.

**The One Colour Per Sound Rule.** A sound's colour belongs to that sound and follows it everywhere it appears in the UI. No other control or state borrows a sound colour, and a new sound gets a new colour.

**The Shape Too Rule.** Meaning never rides on colour alone: a done step shows a check mark, the current step a solid ring, a step to do a dashed outline; a chosen sleeve is raised and wears an ON sticker; a disabled control is dimmed to 45%.

**The Dark Only Rule.** There is one theme, dark (`color-scheme: dark`). No light theme is planned.

## Typography

**Display Font:** Big Shoulders Display ExtraBold (with Arial Narrow, sans-serif), self-hosted.
**Body Font:** Segoe UI Variable Text (with Segoe UI, system-ui, -apple-system, sans-serif).

**Character:** Condensed hand-lettered capitals on the kraft tabs against a plain, legible system face for everything you actually read.

### Hierarchy
- **Display** (800, 44px, 1, uppercase, +0.02em): the KEYFLOW wordmark only.
- **Headline** (800, 22px, 1.15, uppercase, +0.02em): divider-tab names only. A tab may carry a key-range note in the body face (600, 14px, sentence case).
- **Title** (650, 20px, 1.3): a card's state line ("Connect your keyboard", "Sound is on").
- **Body** (400, 16px, 1.5): everything else. Long help text caps at 80ch.
- **Label** (400, 14px): secondary notes, units, `kbd` keys. Step pills and sleeve names sit between label and body at 15px.

Nothing in the DOM goes below 14px except the 12px ON sticker; the canvas labels are 11px (zone strip) and 12px (key letters).

Numbers that change (knob values, latency, held notes) use tabular figures. Strong text is 650.

### Named Rules
**The Tab-Only Display Rule.** Big Shoulders appears on the wordmark and the divider tabs and nowhere else.

**The Self-Hosted Fonts Rule.** Every font ships from `src/assets/fonts/` with its source and license listed in [`src/assets/LICENSES.md`](src/assets/LICENSES.md). No font CDN or runtime third-party request.

## Layout

One column, up to 1360px wide, centred, with 28px top, 48px side and 72px bottom padding (20px / 24px / 56px under 720px). Spacing rides a 4px base (4, 8, 12, 16, 24, 32, 48).

Order, top to bottom:
1. **Masthead:** wordmark, tagline (34ch), and the setup-step stickers pushed right; a `rule` hairline beneath, 20px below the content.
2. **Setup row:** the Keyboard and Sound cards side by side (auto-fit columns, min 480px), 48px below the masthead. This row replaced the theme's next-step bar; the card whose step is "now" carries the yellow ring and the yellow button.
3. **Play card:** the full-width canvas keyboard (180px tall) in its well, then the play bar: the split controls on one side, the held-notes and pedal readout on the other, then the computer-key help.
4. **The crate:** divider cards for Left sound (only while the split is on), Main sound, Pedal & bend and Timing (auto-fit columns, min 380px), left sound first to match the keys. At 1240px and up, Timing alone on the last row spans it, its tips in a second column.

Grids use 48px row and 24px column gaps; the extra row gap leaves room for each card's tab. The keyboard keeps one fixed place and size; later screens (jam mode) keep it there.

## Elevation & Depth

Flat. Depth comes from tonal steps (`well` below `bin` below `card` below `card-raised`), not shadows. Rings that mark state are inset 2px yellow outlines, not elevation.

### Shadow Vocabulary
- **Sleeve floor** (`box-shadow: 0 12px 16px -8px rgb(0 0 0 / 0.7)`): under the chosen sleeve only, as it lifts 12px out of the row.

### Named Rules
**The One Shadow Rule.** The lifted sleeve's floor shadow is the only shadow in the system.

## Shapes

- **Cards:** gently squared (4px), flat, no border.
- **Tabs:** 6px top corners only, sitting 20px above the card's top edge.
- **Sleeves:** square (1:1), 3px corners, original geometric art in the sound's colour.
- **Stickers:** circles (30px for steps, 40px for the ON sticker).
- **Buttons, chips, step pills:** full pills (999px).
- **Selects and hints:** 6px corners.

Motion: 160ms `cubic-bezier(0.16, 1, 0.3, 1)` for a sleeve lifting, the ON sticker appearing, and control hover colours. `prefers-reduced-motion` removes all transitions.

## Components

### Named Rules
**The Native Controls Rule.** Every control is a native button, select, checkbox, radio or range, restyled with the tokens. Chips and sleeves are hidden native radios under a label; no custom widget, knob or fader replaces one.

**The No Notation Rule.** No sheet music or notation anywhere. Prompts and labels use note names (spelled by key), chord symbols and Roman numerals.

**The Redraw On Change Rule.** The canvas keyboard and the live readout redraw in one animation frame scheduled only after a change, never per note through React, and nothing else on screen moves while you play. While a groove plays, the keyboard checks each frame whether the shown chord moved on and redraws only when it did.

### Buttons
Ordinary native buttons, outlined pills.
- **Shape:** pill (999px), 2px `line` border, 600 weight, 8px 20px.
- **Default:** transparent with `bone` text. Hover: border `bone-muted`, fill `card-raised`.
- **Primary:** `now` fill and border, `bin` text, 700 weight; hover mixes 35% `bone` in. Used only per the Next Step Rule.
- **Disabled:** 45% opacity.
- **Focus:** 2px `now` outline, 2px offset (global).

### Chips (pedal mode, training wheels)
- **Style:** native radios hidden over a pill label, 2px `line` border, 6px 16px.
- **Selected:** solid `bone` fill, `bin` text, 650 weight. Focus shows the yellow outline on the chip.

### Cards / Containers (divider cards)
- **Corner Style:** 4px.
- **Background:** `card`, no border, no shadow.
- **Tab:** a kraft label on the top edge naming the card in display capitals, ellipsised if it would overflow.
- **Internal Padding:** 36px top (clears the tab), 24px sides and bottom.
- **State:** the card whose setup step is "now" gets a 2px inset `now` ring.
- Sections built from fieldsets use the tab as their `legend`.

### Inputs / Fields
- **Select:** `card-raised` fill, 1px `line` border, 6px corners, 6px 10px.
- **Checkbox and radio:** native, 18px, tinted by `accent-color: bone`.
- **Range (knobs):** native, full width, accent in the card's sound colour (`bone-muted` outside a sound). Knobs lay out as label, slider, right-aligned tabular value.
- **Mix rows (Groove card, P1-T6):** the knob layout plus a Mute checkbox per row, at most 720px wide under a 650-weight "Mix" label. The groove bass and chords rows take Round Bass and EP Keys colours; Drums and Your synth stay `bone-muted`. A silent row says "Muted" (or "Yours" when you play bass) in `bone-muted` in place of its level.
- **Hint:** a `now`-edged box (55% yellow border, 10% yellow tint over `card`) holding one next step; used for problems as well as guidance.

### Navigation (setup steps)
- **Style:** an ordered list of pill links in the masthead, each a 30px sticker plus a label, linking to its card.
- **States:** done = green sticker with a drawn check mark and the past-tense label; now = yellow sticker with the step number and an inset yellow ring; to do = dashed `line` outline with the number in `bone-muted`. A done step stays in the list.

### Sleeves (signature)
The preset picker. Each preset is a square sleeve of original art over a hidden native radio. Unchosen sleeves sit at 50% opacity (80% on hover) with a muted name. The chosen one lifts 12px, goes full opacity, gains the floor shadow, and an ON sticker in `now` pops in at its top right.

### Canvas keyboard (signature)
- **Keys:** `key-white` whites with a half-opacity `bin` hairline; `card` blacks; all in the `well`.
- **Zone strip:** 20px band over the keys in each zone's sound colour, named in 11px bold capitals in `bin`.
- **Split point:** a 2px `bin` line through strip and keys.
- **Held key:** filled toward the sound playing it, from 30% (soft) to full colour (hard).
- **Letters:** `key-letter` on idle whites, `bin` on other light fills (dimmed, lit), `bone` on dark fills; letters and C-octave names only when a white key is at least 14px wide. A Play-card checkbox (a saved setting) hides the computer-key letters; the C-octave names stay.
- **Highlighting (jam mode, P1-T4b):** two looks, chosen with Look chips in the Groove card and saved. Both dim notes outside the scale toward `well`, never red, and a held key's fill covers every mark.
  - **Tags** (default): a chord tone wears a pill centred 40px (whites) or 26px (blacks) above the key's bottom, `bin` on whites and `bone` on blacks. At Names it holds the note name (13px bold `bone` on whites, 12px bold `bin` on blacks); otherwise it's a 9px-tall pill. A scale tone shows its 12px name at Names, else a 4px dash in `key-letter` (whites) or `kraft` (blacks). Other whites dim 55%, blacks 50%.
  - **Spotlight:** no marks, three brightness steps. Chord tones are lit (whites `#fffbf3`, blacks 90% toward `kraft`), scale tones mid (whites 40% toward `well`, blacks 40% toward `kraft`), the rest dark (whites 70% toward `well`, blacks 50%). At Chord tones every non-chord white sits at 50%. Names at Names sit 32px (whites) or 24px (blacks) above the key's bottom, chord tones in bold.
  - Names are spelled by the scale and then the key, dark on light fills and `bone` on dark ones.
- **Training wheels:** chips in the Groove card (Names, No names, Chord tones, Off), beside a Scale select that offers only the groove's own scales, with one 14px `bone-muted` line describing the chosen level and look.
- **Redraw:** in an animation frame scheduled only after a change, never per note through React.

### Takes (P1-T7)
- **Record:** an ordinary pill button beside Play (smaller, so the transport keeps one row), with a filled `bone` dot (no red: the dot is the shape). While recording it reads "Save take", filled `bone` like Play's Stop, and the Groove, Key and Tempo controls dim to 45% (locked for the take, and during a replay).
- **Takes card:** full width under the Groove card, its tab noting how many takes. Empty, one 16px `bone-muted` line says how to record. Otherwise a list of takes (visible native radios, groove name in 650 over a 14px `bone-muted` line of key, tempo, length and when, tabular figures) beside the chosen take's piano roll, then Replay (pressed: "Stop replay") and Export .mid as outlined pills. The chosen take sits on `card-raised` with a 2px inset `bone` outline; keyboard focus draws it in `now`.
- **Piano roll (canvas):** 260px tall in a `well` like the keyboard. Rows follow the keys turned on their side (`bin` for white keys, `well` for black), a `rule` hairline under each C named in the gutter (11px `bone-muted`). Along the top a 24px strip of chord symbols (13px bold `bone`) on alternating `card` and `card-raised`, a `rule` line down at each chord change, and "Count-in" over the count-in bar. Notes are 2px-rounded bars: chord tones `bone`, scale tones `bone-muted`, others `line` (dimmed, never red), 55% to full opacity by velocity. Drawn on a take change or a resize only.
- **Take stats (P1-T8):** under the roll, label-over-value pairs in a wrapping row (14px `bone-muted` label over a 16px 650 `bone` value, tabular figures, 32px apart): Notes, Range, In the scale, Chord tones on 1 and 3, Longest rest. No big numbers, no score and no colour for good or bad. Under them, the one suggestion as a plain 16px `bone` sentence (not a yellow hint: it isn't a setup step).

## Do's and Don'ts

### Do:
- **Do** give every new sound its own colour and use it on its sleeve, zone strip, lit keys and sliders.
- **Do** keep exactly one yellow action on screen: the next step.
- **Do** show state in shape as well as colour (check mark, solid ring, dashed outline, raised sleeve, dimming).
- **Do** use native controls (button, select, checkbox, radio, range) restyled with the tokens.
- **Do** redraw the canvas keyboard only in an animation frame after a change.
- **Do** dim out-of-scale notes toward `well` in jam mode.
- **Do** put text on stickers, tabs and the primary button in `bin`, never white.
- **Do** self-host every font and list it in `src/assets/LICENSES.md`.

### Don't:
- **Don't** use red anywhere, for errors, wrong notes or anything else.
- **Don't** show sheet music or notation; use note names, chord symbols and Roman numerals.
- **Don't** replace native controls with custom widgets, knobs or faders.
- **Don't** use yellow for decoration, emphasis or a second action; its jobs are the next step, the ON sticker, hints and focus.
- **Don't** add a light theme.
- **Don't** add shadows, gradients, borders on cards, wood grain or paper textures.
- **Don't** animate anything during play except the canvas keyboard.
- **Don't** use Big Shoulders outside the wordmark and tabs, or set new DOM text below 14px.
- **Don't** add badges, mascots, confetti or scores, or a DAW, rack or VU-meter look.
