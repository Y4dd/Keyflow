# Keyflow design theme: Crate Dig

Chosen by the user on 2026-11-25 (P1-T0). This file is the theme: the mood, colours, type, spacing, shapes and motion every screen uses. The mood board ([`mood-board.html`](mood-board.html), rendered as [`mood-board.png`](mood-board.png)) shows them together. `DESIGN.md` at the repo root records the design system built from this theme. A change to the theme itself is the user's call.

## Mood

**A neighbourhood record shop after closing.** Warm dark wood bins, kraft divider cards lettered by hand, a few bright price stickers, and the record you're about to play pulled up out of the crate. It's where funk and soul fans dig for records.

Playing in Keyflow should feel **warm, unhurried and a little playful, and grown-up**: an evening hobby in a dim room, not a lesson or a studio. It should never feel:
- **childish or gamified:** no badges, mascots, confetti or scores;
- **like intimidating pro gear:** no DAW, rack, bezel or VU-meter look;
- **like generic SaaS:** no floating cards, gradients or a blue button.

The scene: evenings in a dim room, the keyboard on a stand, the laptop beside it, read at a glance from a stand's distance. So the app is **dark by default**, with text large enough to read from there.

## The idea

- **Each section is a divider card in a crate.** It has a kraft tab with its name in condensed capitals: Main sound, Left sound, Pedal & bend, Keyboard, Timing.
- **Each sound is a record sleeve.** Choosing a preset pulls its sleeve up out of the row with an ON sticker. This is the signature move. Underneath they're ordinary radio buttons.
- **Each sound owns one colour everywhere:** its sleeve, its zone strip over the keyboard, and the keys it lights when you play.
- **Stickers carry state.** Round price-gun stickers mark the setup steps: done, now, to do. Yellow always means *the thing to do next*.

The world lends colour, type, density and that one move, and nothing else. Controls stay ordinary web controls: buttons, selects, checkboxes, radios and sliders. Navigation stays a plain page. No crate graphics, wood grain or paper textures.

## Colour

Restrained ground, committed sticker colours. Every colour has a job.

| Token | Hex | Job |
|---|---|---|
| `--bin` | `#1c1512` | Page ground (the crate's dark wood) |
| `--well` | `#120d0b` | Inset behind the keyboard |
| `--card` | `#2a201a` | Divider cards (panels) |
| `--card-raised` | `#352920` | Inputs, hover, the unselected chip |
| `--rule` | `#3d2f26` | Decorative hairlines only (the header's bottom edge) |
| `--line` | `#8a7462` | Control outlines, slider tracks, dashed "to do" outlines (3:1 or more on every surface) |
| `--kraft` | `#c8a271` | Divider tabs, the wordmark, small labels |
| `--bone` | `#f1e8da` | Text |
| `--bone-muted` | `#bfb09c` | Secondary text |
| `--funk` | `#ff7b2e` | **Funk Lead** (sleeve, zone strip, lit keys) |
| `--wobble` | `#ff7fae` | **Wobble Bass** |
| `--keys` | `#7cc4f2` | **EP Keys** |
| `--now` | `#ffd25a` | The next thing to do: the current step, the primary button, hints |
| `--done` | `#7fd49b` | Done or connected |

- Text on stickers and on the primary button is `--bin`, never white.
- **No red anywhere.** A problem (sound failed, MIDI refused) is a `--now` hint with one clear next step. Out-of-scale notes will be dimmed, never red (Phase 1).
- Meaning never rides on colour alone. State also shows in shape: a done step has a ✓, the current step has a solid outline, a step still to do has a dashed one. A selected sleeve is raised and carries a sticker. A disabled control is dimmed.
- A light theme isn't planned. The app is used in a dim room, so dark is the only theme.

## Type

| Role | Face | Size / weight | Use |
|---|---|---|---|
| Display | **Big Shoulders Display** ExtraBold, uppercase, +0.02em | 40 px wordmark, 22 px tabs | The wordmark and the divider tabs only |
| Lead | System UI | 20 px / 600 | A card's state line ("Connect your keyboard", "Sound is on") |
| Body | System UI | 16 px / 400, line height 1.5 | Everything else |
| Small | System UI | 14 px | Secondary notes, units |

- System UI is `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif`.
- Big Shoulders Display (SIL OFL 1.1) is self-hosted from `src/assets/fonts/`; its license is in [`src/assets/LICENSES.md`](../../src/assets/LICENSES.md).
- Numbers that change (knob values, latency, held notes) use tabular figures.
- Nothing under 14 px except the canvas labels: 11 px zone-strip names and 12 px key letters.

## Spacing and layout

- A 4 px base: 4, 8, 12, 16, 24, 32, 48, 64.
- The page is one column, up to 1360 px wide, with 48 px side margins (24 px under 720 px). Every panel and the keyboard align to one 12-column grid with 24 px gutters.
- **The keyboard has one fixed place:** full width, right under the header and the setup cards, the same size on every screen. Jam mode and later screens keep it there.
- Order: header (wordmark and setup steps); the setup cards (Keyboard and Sound side by side, the current step outlined in `--now`); the Play card with the keyboard, the split controls and the held-notes and pedal readout; then the crate of divider cards (Left sound, Main sound, Pedal & bend, Timing), left sound first to match the keys.
- **Setup steps stay in view.** The header shows Keyboard, Sound and Timing as stickers. A done step is marked, never removed.

## Shapes

| Element | Shape |
|---|---|
| Divider card | 4 px corners, flat `--card`, no border, no shadow |
| Divider tab | 6 px top corners, `--kraft`, sits on the card's top edge |
| Sleeve | Square, 3 px corners, with original geometric art in its sound's colour |
| Sticker | A circle |
| Buttons and chips | Pills |
| Inputs | 6 px corners, `--card-raised` |

- The only shadow is under the lifted sleeve: `0 12px 16px -8px` black at 70%, a soft floor shadow.
- No gradients except inside sleeve art.

## Motion

- 160 ms ease-out for a sleeve lifting and a step getting its ✓. Nothing else moves.
- **Nothing on screen moves while you play** except the canvas keyboard, which redraws only after a change.
- `prefers-reduced-motion`: no motion at all.

## The keyboard (canvas)

| State | Look |
|---|---|
| Idle white key | `#efe6d6` (bone, a touch darker than text) with a `--bin` hairline between keys |
| Idle black key | `#2a201a` |
| Well behind the keys | `--well` |
| Zone strip | Each zone's sound colour, label in 11 px bold capitals in `--bin` |
| Split point | A 2 px `--bin` line through the strip and keys (dark, so it shows on the light keys) |
| Held key | Filled toward the colour of the sound playing it: soft notes lighter, hard notes closer to the full colour |
| Computer-key letters | `#6b5a4c` on white keys, `--bin` on lit white keys, `--bone` on black keys |

Planned for Phase 1 (P1-T4), so jam mode builds on this:
- **chord tones:** a large sticker dot in the sound's colour at the bottom of the key;
- **scale tones:** a small `--kraft` dot;
- **other notes:** the key dimmed toward `--well`, never red.

A held key keeps its fill on top of any dot.

## Voice

Plain, short and second person, saying what to do next: "Click anywhere to turn sound on." There's one suggestion at a time. No exclamation marks, no praise inflation, no jargon without a one-line explanation.

## Kept from the directions not chosen

| From | What it adds |
|---|---|
| Ticket Wallet | Setup steps stay visible and get marked done. |
| Grid Specimen | One grid that everything aligns to. |
| Botanical Folio | The keyboard keeps one fixed size and place. |
| Catalog Sleeve | Each sound owns one colour everywhere. |
| Emission Rail | State shows in shape as well as colour. |
