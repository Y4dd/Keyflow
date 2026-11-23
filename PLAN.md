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

**Task status** is tracked in each phase file by adding a marker after the task heading, e.g. `### P0-T3: Input bus and MIDI layer [done 2026-12-01]` or `[in progress]`. Headings with no marker are not started. This table tracks phase-level status.

| # | Phase | Status | File |
|---|---|---|---|
| 0 | Foundation: hardware check, MIDI, synth, split, pedal, latency | In progress (P0-T1 to P0-T5 done; next P0-T6) | [phase-0-foundation.md](docs/phases/phase-0-foundation.md) |
| 1 | Jam mode: grooves, highlighting, record and replay | Not started | [phase-1-jam-mode.md](docs/phases/phase-1-jam-mode.md) |
| 2 | Drills and curriculum: spaced review, soloing scales, chords | Not started | [phase-2-drills-curriculum.md](docs/phases/phase-2-drills-curriculum.md) |
| 3 | Comping mode | Not started | [phase-3-comping.md](docs/phases/phase-3-comping.md) |
| 4 | Solo coaching and ear training | Not started | [phase-4-solo-coaching-ear-training.md](docs/phases/phase-4-solo-coaching-ear-training.md) |
| 5 | Song import | Not started | [phase-5-song-import.md](docs/phases/phase-5-song-import.md) |
| 6 | Sound lab and leads library | Not started | [phase-6-sound-lab-leads.md](docs/phases/phase-6-sound-lab-leads.md) |

Status values: `Not started`, `In progress (task X)`, `Done`, `Revised (see log)`.

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

---

## Open questions

- Per-phase open questions are listed in each phase file.
