# Keyflow: Plan

Keyflow is a browser app that teaches piano to adults through a MIDI keyboard, aimed at one goal: **playing synth solos and chords over grooves**, in the spirit of electro-funk and soul synth playing. It teaches theory by doing (drills, jamming, comping), built on established learning and motor-skill principles, with a built-in synth that sounds good from the first note.

It is a personal tool first, released as open source (MIT) for others to enjoy.

> **This file is the single source of truth for phase status, decisions and open questions.** Phase details live in `docs/phases/`. Phases are open to discussion: to change one, propose the change, then update the phase file **and** add a line to the decisions log below.

---

## The learner (primary user)

- Adult, 6-year software developer, knows very general theory: can tell how C major is built but not E minor offhand, and knows how scales are constructed in principle. Knowledge is fragmented and memorized, not worked out or automatic.
- Can play a couple of chords from memory.
- Inspiration: playing by ear over songs with synths. Smooth melodic synth solos over soul and funk tracks; deep, heavy distorted bass with sub-bass; **pitch-bent leads**.
- Genres: everything, but especially **electro-funk synth solos and soul**.
- Practice time: 5 to 60 minutes a day. More if it is fun.
- **No sheet music.** Notation reading is out of scope.

### Priorities (ranked by the user)
1. **Solo:** improvising over a groove
2. **Comping:** rhythmic chord accompaniment
3. **Chords:** knowing and building chords and voicings
4. **Leads:** learning set melodic lines, riffs and licks
5. **Learn songs:** playing over real songs

### Hardware
- **Yamaha YPT-380**, 61 keys, velocity-sensitive, USB-to-host MIDI, **no pitch bend wheel**.
- **One sustain pedal**, the only pedal.
- Gaming laptop, Windows 11. Browsers: **Firefox and Chrome are both supported.**

---

## Product pillars

| Pillar | What it is |
|---|---|
| Play | Built-in synth (funk lead with glide, wobble bass plus sub, electric piano keys) and a split keyboard. Pitch-bend substitutes: legato glide, pedal-bend mode, laptop bend. |
| Jam | Original grooves built from pattern data, so the app always knows the current chord. It highlights chord tones and scale tones live and records and replays takes. |
| Learn | Spaced, interleaved drills for scales, chords and voicings, with hints that fade as you learn. Tracks speed, aiming for automaticity, not just correctness. |
| Comp | Play chord changes in time over grooves. Scored on chord accuracy, timing, voice leading and rhythm. |
| Ear | Call and response, scale-degree hearing, find-the-key and chord-quality games. |
| Songs | Import your own audio locally. Key and tempo detection, looping, slowdown, chord chart, then jam over it. |
| Sound | A guided sound-design lab and a library of original licks. |

Learning principles behind all of this: [`docs/learning-design.md`](docs/learning-design.md). Stack and code structure: [`docs/architecture.md`](docs/architecture.md).

---

## Phases

Each phase file stands alone: goal, scope, tasks with IDs and acceptance criteria, open questions and done-when. AI sessions should take **one task ID at a time**, by default in the order listed.

**Task status** is tracked in each phase file by adding a marker after the task heading, e.g. `### P0-T3: Input bus and MIDI layer [done 2026-12-01]` or `[in progress]`, or `[built 2026-12-01, manual check pending]` when only the user's manual check is left. Headings with no marker are not started. This table tracks phase-level status.

| # | Phase | Status | File |
|---|---|---|---|
| 0 | Foundation: hardware check, MIDI, synth, split, pedal, latency | Done (2026-11-25) | [phase-0-foundation.md](docs/phases/phase-0-foundation.md) |
| 1 | Jam mode: grooves, highlighting, record and replay | Not started | [phase-1-jam-mode.md](docs/phases/phase-1-jam-mode.md) |
| 2 | Drills and curriculum: spaced review, soloing scales, chords | Not started | [phase-2-drills-curriculum.md](docs/phases/phase-2-drills-curriculum.md) |
| 3 | Comping mode | Not started | [phase-3-comping.md](docs/phases/phase-3-comping.md) |
| 4 | Solo coaching and ear training | Not started | [phase-4-solo-coaching-ear-training.md](docs/phases/phase-4-solo-coaching-ear-training.md) |
| 5 | Song import | Not started | [phase-5-song-import.md](docs/phases/phase-5-song-import.md) |
| 6 | Sound lab and leads library | Not started | [phase-6-sound-lab-leads.md](docs/phases/phase-6-sound-lab-leads.md) |

Status values: `Not started`, `In progress (task X)`, `Done`, `Revised (see log)`.

---

## Manual checks waiting

Checks only the user can do (hands, ears, the real YPT-380). Work carries on past them until a stop rule in `CLAUDE.md` applies ("Manual checks" there says how they're written and reported). Scripts live in [`docs/manual-tests/`](docs/manual-tests/README.md), one file per waiting task, and the Task cell links it. Reply with shorthand: `P0-T6 pass`, `P0-T6 3 fail: <what happened>`, `P0-T6 taste: <choice>`.

| Task | Must-pass steps | Taste steps | Blocks | Browsers | Minutes |
|---|---|---|---|---|---|

---

## Decisions log

Newest last. Format: `YYYY-MM-DD: decision. Reason.`

- 2026-11-23: Feature order approved: Foundation → Jam → Drills → Comping → Solo coaching and ear → Songs → Sound lab and leads. The user's ranked priorities put soloing first, and jamming is the most motivating first experience.
- 2026-11-23: No sheet music or notation reading. The user doesn't want it.
- 2026-11-23: "Solo" means improvising; "Leads" means learning set melodic lines, riffs and licks. Confirmed by the user.
- 2026-11-23: The keyboard has no pitch bend wheel. Bends come from three substitutes: legato glide, pedal-bend mode and laptop bend. Confirmed by the user.
- 2026-11-23: There is one sustain pedal, so **pedal function is a mode setting** (Sustain / Bend / Glide-hold). In Bend mode, sustain is unavailable. One pedal can't do both.
- 2026-11-23: Support both Firefox and Chrome. It's the same Web MIDI API; the extra cost is a Firefox onboarding screen (site-permission add-on prompt) and testing in two browsers.
- 2026-11-23: Stack is TypeScript + Vite + React + Tone.js + Zustand + Dexie + ts-fsrs + tonal. Chosen for performance (audio runs in native Web Audio nodes off the UI thread) and ease of AI generation (all widely used). Details and rationale are in `docs/architecture.md`.
- 2026-11-23: Local-first, with no backend or accounts. Static deploy to GitHub Pages.
- 2026-11-23: All musical content (grooves, progressions, licks, presets) is original. No copyrighted recordings or transcriptions ship with the app. Nothing is named after real artists. The user's own song files are processed locally and never uploaded.
- 2026-11-23: MIT license. Dependencies must have MIT, Apache-2.0, BSD or ISC licenses. GPL, LGPL and AGPL are not allowed without an explicit decision logged here.
- 2026-11-23: Lint with **oxlint instead of ESLint**. The current Vite template ships TypeScript 7 plus oxlint, and `typescript-eslint` requires `typescript <6.1`, so ESLint can't type-lint TS 7. The React hooks rules are enabled in oxlint. Revisit if typescript-eslint adds TS 7 support and a needed rule is missing.
- 2026-11-23: Toolchain is Node 26, TypeScript 7.0.2 and exact-pinned dependencies with a committed lockfile. CI uses `npm ci`. End-to-end tests run in Chromium and Firefox.
- 2026-11-23: Public GitHub repo `Y4dd/Keyflow`, deployed to GitHub Pages at the `/Keyflow/` sub-path. The `LICENSE` holder is the GitHub username `Y4dd`. Commits use GitHub's no-reply address, set in the repo-local git config, so no personal email is exposed in a public repo.
- 2026-11-23: The project stays at `C:\Users\yadds\OneDrive\Documents\Projects\Keyflow`. OneDrive is disabled on this machine, so the path is a plain local folder with no sync concerns.
- 2026-11-23: The P0-T2 hardware check page is deployed as a second Vite entry (`/spike/hardware.html`), not kept dev-only. Firefox reportedly skips the add-on prompt on loopback origins, and P0-T2 must record when that prompt appears. It is removed when P0-T3 lands.
- 2026-11-23: P0-T2 findings adopted. Firefox and Chrome both stay supported (both feel instant; Firefox adds about 25 ms of MIDI delay, handled by per-browser calibration). MIDI input accepts all channels, and the pedal is down if CC64 on any channel is ≥ 64 (the YPT-380 sends the pedal on ch 1–3, and ch 3 always reads 0). P0-T5 must find a supported way to read `outputLatency` and `getOutputTimestamp`, which Tone's context wrapper hides. Details are in Findings in the Phase 0 file.
- 2026-11-23: P0-T3 MIDI layer: listen to all inputs by default (device selector when there are several); "invert pedal" inverts the any-channel aggregate, not each channel; unplugging releases held notes and the pedal; MIDI onboarding keeps the six specified states plus a `checking` flag for the moment before the permission query answers. The P0-T2 spike page is deleted (recoverable from c25542f).
- 2026-11-23: P0-T4 fixtures store raw MIDI messages (with clock and active sensing only counted), not parsed InputEvents. Raw bytes keep channels (needed to settle the same-pitch-on-two-channels question) and test the parser itself; replay runs them through it.
- 2026-11-23: "Dev builds only" for window.__keyflow and the event inspector means the dev server plus builds made with `KEYFLOW_DEV_TOOLS=true`. Playwright builds that way into `dist-e2e/`, since e2e runs against a build. CI fails if `__keyflow` appears in the production `dist/`. Fixtures are recorded on the local dev server (Chrome), not the deployed page.
- 2026-11-23: Held notes and the pedal moved from the MIDI panel to a new Play panel with the on-screen piano, so the computer keyboard and on-screen fallbacks work without a MIDI device. The computer keyboard maps physical key codes: home row = white keys, the row above = black keys, Z/X = octave.
- 2026-11-23: P0-T5 reads `outputLatency` and `getOutputTimestamp` through standardized-audio-context's **private `_nativeAudioContext` field**, in one feature-checked accessor (`src/audio/latency.ts`) that returns nulls if the field disappears. No supported route exists: the wrapper (25.3.77) has neither property and exports no native-context getter, and `Tone.setContext(nativeContext)` fails in Firefox (P0-T2). An e2e test asserts the readout in Chromium and Firefox, so a Tone or standardized-audio-context upgrade that breaks it fails CI.
- 2026-11-23: The audio engine (and Tone.js, which creates its AudioContext on import) loads with a dynamic import on the first click or key press, so no context exists before a user gesture and Tone stays out of the main bundle. Tone's default context is the one context (`latencyHint: "interactive"` is Tone's default). MIDI notes are not user gestures, so the Sound panel asks for a click when notes arrive with sound off. Note-ons while the context is suspended are dropped, not queued. Starting doesn't wait for `resume()` (without user activation it may never settle); every click or key press retries it until the context runs, so a first event that isn't an activation (a held touch, Escape) can't lock sound out.
- 2026-11-23: Master chain is gain → limiter → safety clip. The limiter (a DynamicsCompressor) is the spec; the safety clip is an addition, **agreed by the user**, who chose to keep the chain as built (option (a) in the Phase 0 open question): playing through it feels instant despite the limiter's 6 ms. The compressor isn't a ceiling: a ten-note full-velocity EP chord peaked at 1.16 through it. The clip is a WaveShaper, exactly linear up to 0.9 and below full scale beyond, with no delay; e2e renders check that playing as hard as the YPT-380 recording stays in its linear part. Measured: the compressor delays all sound by 6.0 ms in both browsers (see Findings).
- 2026-11-23: Voice logic is Keyflow's own, not Tone's PolySynth or MonoSynth, so it can be unit-tested and the legato-only glide controlled per note. Poly: 10 voices; a pitch replays on the voice still ringing it; when all are busy the oldest held note is stolen. Mono: last-note priority; lifting the sounding key returns legato (with glide) to the newest key still held. Both ref-count a pitch pressed by two sources. The Wobble Bass sub rejoins after the compressor, so neither distortion nor compression touches it; the saws' amp gate sits before their compressor, because the compressor's 6 ms delay made a gate after it open on the previous note's pitch. Pedal and bend events reach the engine but do nothing until P0-T7. Radios, checkboxes and sliders no longer stop the computer keys from playing (only text fields do).
- 2026-11-24: **Split keyboard works like the YPT-380's own split (plan change, agreed by the user).** The P0-T6 spec had two fixed zones; the user chose an on/off split instead, so one sound can still cover the whole keyboard (two-handed EP Keys comping). A **main** sound plays the whole keyboard, or the keys from the split point up when Split is on; a **left** sound plays the keys below it. Each has its own preset and octave shift (−2 to +2). Defaults: Split on at G3 (MIDI 55; C4 = middle C = 60, the app's naming), Wobble Bass left, Funk Lead main, no octave shift. The split point is set from a menu or, also agreed, by pressing a key (that key becomes the main sound's lowest and doesn't sound). A note-off follows the route its note-on took, never the current layout, so moving the split or an octave while keys are held can't strand a note. Each zone has its own instrument instance, even when both use the same preset; knob values stay per preset and reach every instance of it.
- 2026-11-25: **Autonomous workflow (the user's request).** Claude commits and pushes to `main` without asking once typecheck, lint, format:check, test and test:e2e pass, then confirms CI itself. Manual checks go into a "Manual checks waiting" queue here and don't block the next task. Claude stops only for changes to what a task delivers, destructive actions, or a manual check the next task depends on, and otherwise at the end of each phase. New task marker: `[built …, manual check pending]`. Rules are in `CLAUDE.md`.
- 2026-11-25: **Hardening the autonomous workflow (the user's request).** (1) `npm run check:rules` (`scripts/check-rules.ts`, run in CI) enforces the hard rules a script can check: no `Tone.now()`, pure modules free of DOM, Tone, React, Dexie and app state, no React on the audio and input path, shipped dependencies MIT, Apache-2.0, BSD or ISC (dev tools may use other licenses, but nothing GPL-family), and no notation packages. Opt-outs need `// rules-allow: <rule>: <reason>`. (2) Every task is reviewed by `ecc:typescript-reviewer` (plus `ecc:react-reviewer` for `.tsx`) before it's committed. (3) Each task runs in its own fresh session started by the user's Main Agent session, one at a time. (4) Manual checks are split into must-pass and taste steps, list which tasks they block, cap at three waiting must-pass checks, run as one combined script, and every failure becomes an automated regression test before it's fixed.
- 2026-11-25: **Ponytail replaces ECC in the workflow (the user's request).** The coding style is Ponytail `full`, and the review before each commit is `ponytail:ponytail-review`, run by one fresh read-only subagent (replacing the ECC reviewer agents). Nothing in the workflow depends on ECC any more. CI is unchanged: it runs no AI, and the rule check plus the existing gates cover it.
- 2026-11-25: **P0-T7 pedal and bends.** Sustain holds both sounds; Bend, Glide-hold and the laptop bends move only the main sound (the lead hand), so a left-hand bass stays in tune under a bent lead. Bends from every source add up, never pass the bend amount either way (1 or 2 semitones, default 2), and move at one speed: a full bend takes the bend time (default 100 ms, 0–400), smaller moves proportionally less, so the pedal, the key, the wheel and its spring-back share one rule. A mode change with the pedal down acts as if the pedal lifted. Sustain withholds note-offs, counted per press, and releases them oldest press first, so a mono sound never jumps back to an older note on the way out; a re-pressed sustained note restrikes on EP Keys but not on the mono sounds. Glide-hold glides detached notes from the last pitch played at the sound's glide time (Funk Lead's knob, Wobble Bass's fixed glide, none on EP Keys). The bend key defaults to Space (\ or off in a menu, the open question stays open until manual check 5). Space stays a control's own key when the control was reached with Tab, so keyboard users can still toggle a checkbox, and bends after a click: the app records how focus arrived, because `:focus-visible` matched a clicked control in e2e in both browsers once a key was pressed. The wheel bends only over the on-screen keys (100 px per semitone, scrolling up bends up, springs back 150 ms after scrolling stops), so the page still scrolls elsewhere. Invert pedal sits with the pedal controls and applies to devices plugged in later. Settings aren't saved until P0-T9, and a pedal held while sound is off is only noticed at its next change. Found on the way (it predates P0-T7): Tone throws when an EP voice restarts at its last start time, and Firefox's audio clock can read the same time for several events, so a steal or a key pressed twice in one tick threw inside the input listener; such a restart now starts 1 ms later.
- 2026-11-25: **P0-T8 calibration.** The offset is the tap's input timestamp (the event's `time`, not when the handler ran, which in Firefox is about 25 ms later) minus the click's audio-clock time mapped to performance time by `contextToPerfMs` (`src/audio/latency.ts`); positive means taps land after the click. Grading must map beats with that same function and subtract the offset. The mapping pairs the clocks with `getOutputTimestamp()` when its reading is within 500 ms of `currentTime` and `performance.now()` read together, else with that pair; whether the timestamp already includes output latency in each browser isn't verified, so the Timing panel shows its lead beside `outputLatency` and the manual check records both. The two mappings differ by that lead, so the lead is kept with the offset (null for the fallback), and P0-T9 must save it too. Clicks go through the master (so the offset includes its 6 ms) and are scheduled up front on the audio clock. Taps still sound, as they will when playing along later. The test is 16 clicks at 100 BPM with a four-click count-in; a run counts with at least 8 of 12 beats and a spread (standard deviation after outlier rejection: 3 scaled MADs, never under 40 ms) of at most ±30 ms. Those thresholds are guesses until the manual check. The offset isn't saved until P0-T9, and storage is per browser, so it isn't keyed by browser.
- 2026-11-25: **P0-T9 canvas keyboard and settings.** The canvas keyboard **replaces** the DOM on-screen piano rather than sitting beside it: one 61-key keyboard (C2 to C7) both shows what's held and plays on click or touch, since the DOM piano was the stand-in for this task. It draws only after a change, in an animation frame. e2e reaches its keys through `window.__keyflow.pianoKey(note)` (a point to click and whether the key is drawn lit). Settings are one Dexie row per setting in a `settings` table (database version 1), read back through `parseSettings`, which falls back to the default one field at a time. **Only what differs from the defaults is stored** (leaf by leaf; a setting at its default has no row), so a default changed later, such as a taste answer from a manual check, still reaches anyone who never changed it, and only rows whose stored value changed are written, so a second tab doesn't write its older settings back. Saving starts only once the saved values are applied, so defaults never overwrite them; a setting the user changed while storage loaded keeps the change (in e2e the first IndexedDB open took seconds under load in Firefox, and applying over it reset the pedal mode); and if storage can't be read the app runs on defaults and saves nothing. The **audio-started hint** is read as a saved flag that only changes the Sound panel's text before sound starts ("Your sound settings are back. Click anywhere or press a key to turn sound on."): sound still never starts without a gesture (2026-11-23). The chosen MIDI input is saved as the connection's `preferredId`: while it's unplugged every input is listened to, and when it reappears it's listened to alone again (notes held on the others are released). Whether port ids survive a reload isn't verified; if not, the choice simply isn't applied. Also saved, as P0-T7 and P0-T8 asked: invert pedal, the bend key, and the calibration offset with its output-timestamp lead.
- 2026-11-25: **Glide-hold slides for at least 150 ms** (P0-T7 manual check 4). At Funk Lead's 60 ms default glide the user couldn't hear glide-hold until raising the Glide time knob. The minimum applies only while glide-hold is on; legato glide with the pedal up still uses the knob. So with the pedal down, Glide time settings under 150 ms change nothing, and Wobble Bass as the main sound slides for 150 ms instead of its fixed 30 ms. P0-T7 check 5 (laptop bend) wasn't reproduced and later passed; the probable cause is in Phase 0 Findings. Space stays the bend key. Taste step 3 went unanswered, so the bend defaults stay.
- 2026-11-25: **Manual test scripts move to `docs/manual-tests/` and design work uses the `impeccable` skill (the user's request).** Each waiting check is one file there (`P1-T1.md`), linked from the queue, deleted when it passes; phase files keep the checks as spec. Any task that needs a component or screen designed runs `impeccable`, within the hard rules. The user also wants **the whole app redesigned** at some point to be friendlier and prettier; when is an open question.

---

## Open questions

- Per-phase open questions are listed in each phase file.
- **App redesign** (friendlier and prettier, with `impeccable`): when, and whether it gets its own phase. Phase 1 adds a lot of UI, so a design-system pass before it would save redoing that UI later.
