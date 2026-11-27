# Architecture

This is the single place where the stack, code layout, timing model and core types are defined. Phase files link here rather than restating it. Change it by proposing the change and logging it in `PLAN.md`.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict: true` | Types catch music-math bugs (MIDI numbers vs. pitch classes vs. seconds). Best-supported language for AI generation. |
| Build/dev | Vite | Fast HMR, trivial static build for GitHub Pages. |
| UI | React 18+ | Most widely known UI library, so AI output is reliable. UI is never on the audio hot path (see rules), so framework speed doesn't matter. |
| UI state | Zustand | Tiny, and it can be read outside React (`store.getState()`) from audio, MIDI and canvas code without re-renders. |
| Audio | Tone.js on top of Web Audio | Synths, effects and tempo-synced LFOs are **native Web Audio nodes** that render on the audio thread. The Transport's callbacks run on the **main thread** and schedule notes ahead of time (look-ahead), so long main-thread work (heavy React renders) can make grooves late. Keep the main thread light. Escape hatch: raw Web Audio or a custom `AudioWorklet`, possibly Rust→WASM later, only if a measured need appears. |
| Theory | `tonal` | Notes, intervals, chords, scales, keys, Roman numerals and chord detection. |
| Spaced repetition | `ts-fsrs` | Implements the FSRS scheduling algorithm. |
| Storage | Dexie (IndexedDB) | Local-first persistence for settings, review state and takes. |
| MIDI files | `@tonejs/midi` | Export takes as `.mid`; read MIDI fixtures. |
| Visuals | Canvas 2D driven by `requestAnimationFrame` | Keyboard, note highway and piano roll at 60 fps without React re-renders. |
| Tests | Vitest for unit tests, Playwright for end-to-end | Pure logic is unit-tested. E2E uses the simulated MIDI source (below). |
| Lint/format | oxlint + Prettier | oxlint is the current Vite template default, fast, and works with TypeScript 7. `typescript-eslint` doesn't support TS 7 yet (it requires `typescript <6.1`). The React hooks rules (`rules-of-hooks`, `exhaustive-deps`) are enabled in `.oxlintrc.json`. |
| Deploy | GitHub Pages via GitHub Actions | Free and static. No backend. |

**Verified in P0-T1 (2026-11-23)** and pinned exactly in `package.json`. Direct dependencies are MIT or Apache-2.0. All 46 production (shipped) packages, including transitive ones, are MIT, Apache-2.0, BSD-3-Clause or 0BSD. The lockfile includes the Linux native binaries CI needs, and a sub-path build (`VITE_BASE=/keyflow/`) prefixes the asset URLs correctly. Node 26, TypeScript 7.0.2, Vite 8.3.8, React 19.3.1, Tone 15.1.22, tonal 6.9.0, ts-fsrs 6.0.1, Dexie 4.4.7, Zustand 5.1.0, @tonejs/midi 2.0.28, Vitest 5.1.1, Playwright 1.65.1, oxlint 1.94.0, Prettier 3.10.1. `src/stack.test.ts` proves that each library imports and works under this toolchain.

## Code layout (target)

```
src/
  input/        Unified input bus. All sources emit the same InputEvent.
    midi/       Web MIDI access, device hot-plug, message parsing, Firefox onboarding state
    computer/   Computer-keyboard-to-notes mapping, laptop bend
    onscreen/   On-screen piano pointer input
    sim/        Simulated MIDI source: scripted events and fixture replay (tests, dev)
  audio/        AudioContext setup, engine, voices, presets, effects, pedal and bend logic
    presets/    Preset definitions as plain data (JSON-serializable)
  music/        Pure theory helpers wrapping tonal: spelling, chords, scales, Roman numerals
  grooves/      Groove pattern data plus the groove player; harmony timeline
  practice/     Drills, grading, curriculum graph, FSRS scheduling, session builder
  analysis/     Take analysis, chord recognition from held notes, (Phase 5) key/BPM detection
  storage/      Dexie database, schema versions, repositories
  state/        Zustand stores (settings, session, UI)
  ui/           React components
    canvas/     Canvas renderers (keyboard, highway, piano roll)
  dev/          Dev-only tools (event inspector, latency readout, MIDI injection hook)
```

`music/`, `practice/` (except storage calls), `analysis/` and the parsing in `input/midi/` are **pure functions** with unit tests. They have no DOM, no Tone.js and no React.

## Hot-path rules (non-negotiable)

1. **MIDI → sound never goes through React.** The MIDI callback calls the audio engine directly. React and Zustand are told afterwards for display.
2. **Live notes trigger immediately.** In Tone.js, pass `Tone.immediate()` explicitly as the time for live input. Don't use `Tone.now()` or omit the time argument: an omitted time resolves to `Tone.now()`, which adds the context's look-ahead (≈0.1 s by default) and makes playing feel laggy. P0-T2 confirms this by ear and measurement. Scheduled backing parts use the Transport and look-ahead normally.
3. **No allocation-heavy work per MIDI event.** No logging objects to the console, no state cloning and no `JSON.stringify` on every note in production.
4. **Canvas reads state on each frame** from a mutable ref or `store.getState()`. It does not subscribe React components to per-note updates.
5. **One AudioContext** for the app, created and resumed on a user gesture with `latencyHint: "interactive"`.

## Audio engine (P0-T5)

- **Loading:** `src/state/audio.ts` (no Tone import) owns the status and the store. On the first click or key press it dynamically imports `src/audio/tone/engine.ts`; importing Tone creates the one AudioContext, so none exists before a gesture. It doesn't wait for `resume()`, which may never settle without user activation; every click or key press retries it until the context runs. Notes pressed while starting and still held when sound first runs play then.
- **Hot path:** input bus → `audio.handle` → `engine.handle` → instrument, synchronously, at `Tone.immediate()`. Every per-note param write passes that time explicitly (Tone's `param.value =` and `rampTo()` without a time use `Tone.now()`).
- **Instruments** are instances built from preset data (`src/audio/presets/`): pure voice logic (`src/audio/voices.ts`) decides, Tone graphs (`src/audio/tone/voices.ts`) sound. Connecting a signal to a Tone param overrides the param's value, so knobs drive the modulator (filter-envelope base, LFO min and max), not the param.
- **Split keyboard:** a pure router (`src/audio/zones.ts`) picks each note-on's zone and pitch from the engine's own copy of the layout and remembers the route; the note-off follows that route, never the current layout, so layout changes can't strand held notes. One instrument instance per zone (both can use the same preset), built on layout changes, never on a note.
- **Pedal and bends (P0-T7):** a pure model (`src/audio/expression.ts`) turns pedal events (by mode: Sustain, Bend, Glide-hold) and `bend` events (summed per source, clamped to the bend amount) into targets; the engine sends only what changed. Sustain reaches both zones' instruments, whose latch withholds note-offs until the pedal lifts; bends and glide-hold reach the main sound only. Mono voices bend through a `Multiply` after the played-pitch signal (glides and bends are separate params, so neither cancels the other); EP Keys bends through FMSynth's detune. The laptop bend (`src/input/computer/bend.ts`) emits `bend` events like any source. At the bend amount "to next scale tone" (P1-T5, the default) bends count in steps of the solo scale (range 1): the engine keeps its own copy of the scale's pitch classes (pushed from `src/state/groove.ts` when sound starts and on a key or scale change) and hands it to the main sound, which turns the step into semitones per sounding note (`scaleBend`, `src/music/bend.ts`): a mono voice re-targets on every new or legato note, each poly voice bends to its own note's step.
- **Master:** gain → limiter (DynamicsCompressor, about 6 ms of delay) → safety clip (WaveShaper, linear to 0.9, no delay) → destination. Kept as built (decisions log, 2026-11-23).
- **Mixer (P1-T6):** four channel buses before the master (`src/audio/tone/mixer.ts`): drums, bass and chords through the groove's fixed −3 dB, your synth (both zones) straight in. Their gains come from `channelGains` (`src/audio/mixer.ts`, pure), ramped over 20 ms from `Tone.immediate()`; "you play bass" mutes the bass bus only while the split is on. The count-in click goes to the groove level, past the drums bus, so muting the drums keeps it. The dev groove render builds the same buses.
- **Latency readout:** `src/audio/latency.ts` reads the native context through standardized-audio-context's private `_nativeAudioContext` field, feature-checked; see the decisions log.

## Grooves (P1-T1)

- **Format:** `src/grooves/groove.ts` (pure) defines `Groove` as plain JSON: tempo, swing (0..1), key (tonic pitch class plus mode), bars, a progression of Roman numerals with beats, and three looping tracks on a 16th-note step grid: drums (velocity per step per voice), bass (chord-relative scale degrees with rhythm) and chords (a chord-tone voicing template with rhythm), plus a default solo scale and alternatives. 4/4 and straight 16ths only for now.
- **Roman numerals** (`chordOf`, `src/music/harmony.ts`) count degrees from the major scale in every mode (tonal's convention: a minor key writes bIII, bVI, bVII); case gives the triad (`i7` = m7, `IV7` = dominant 7). Everything resolves to pitch-class offsets from the tonic, so `transpose` only changes the tonic.
- **Ticks:** `harmonyAt(groove, ticks, scale?)` takes unswung transport ticks at `PPQ = 192` (Tone's default; the player must assert it). The progression loops on its own length, and negative ticks (a count-in) wrap from the end. Swing is the pure `stepTick(step, swing)`: every second 16th moves from halfway through its 8th (swing 0) to two thirds of the way (2:1, swing 1), rounded to whole ticks, so Tone's Transport swing stays 0.
- **Player (P1-T2):** `src/grooves/schedule.ts` (pure) turns a groove into one bar of events at a time: drum hits, count-in clicks, and bass and chord ons and offs paired by id (offs first at a tick). Pitches are read from `harmonyAt` at each note's start. `src/audio/tone/groove.ts` (built by the engine on first use, with its own Wobble Bass and EP Keys instances and the synthesized kit in `drums.ts`) schedules each bar on the Transport half a bar ahead with `scheduleOnce`, at ticks offset by a one-bar count-in when it's on. Stop clears only its own events and releases its notes one look-ahead out. `src/state/groove.ts` holds the transport controls for the UI. A synced Wobble Bass LFO follows the tempo through `Transport.syncSignal` and restarts its cycle at the groove's start.
- **Highlighting (P1-T4):** `tierOf` (`src/music/highlight.ts`, pure) gives each key's tier under a `HarmonyAt` and a training-wheels level (3 all tiers plus names, 2 all tiers, 1 chord tones only, 0 off), and `noteNames` (`src/music/spelling.ts`) spells the 12 pitch classes by the solo scale and then the key. The keyboard shows the harmony at `previewTick` (`src/grooves/groove.ts`): the player's ticks plus half a beat while playing, else tick 0, so the count-in and a stopped groove show the first chord. `src/state/groove.ts` holds the chosen scale (reset to the groove's own on a groove change) and the level, and reads the player's `ticks()` only while playing, since `engine.groove()` builds the player on first use. While playing, `OnscreenPiano` compares `stepIndexAt` each frame and redraws only when the step changes.
- **Bass degrees** are degrees of the current chord's own scale (`degreeSemitones`: Dorian for m7, Mixolydian for 7, Locrian for m7b5, major for maj7), so degree 3 is always the chord's third and one pattern follows the changes.

## Timing model

There are three clocks. Keep them straight.

| Clock | Source | Used for |
|---|---|---|
| Performance time (ms) | `performance.now()`, `MIDIMessageEvent.timeStamp` | Raw input timestamps |
| Audio time (s) | `AudioContext.currentTime` (= `Tone.immediate()`) | Scheduling sound. Note that `Tone.now()` = currentTime **+ look-ahead**. |
| Musical time | Tone Transport position (bars:beats:sixteenths) and ticks | Grooves, grading against the beat |

- Map audio time to performance time with `contextToPerfMs(readClock(...), t)` (`src/audio/latency.ts`, P0-T8; the engine's `clock()`). It pairs the clocks with `AudioContext.getOutputTimestamp()` (`{contextTime, performanceTime}`) when that reads sane, else with `currentTime` and `performance.now()` read together. Calibration and grading must both use it, or the offset means something different in each.
- **Grading** converts each input event's timestamp into musical time, then applies the user's stored **calibration offset** (from the Phase 0 tap test) before comparing with the expected beat. The offset (P0-T8, `src/audio/calibration.ts`) is the median of tap `time` minus the click mapped to performance time; positive means the user lands late, so subtract it from an input's time before comparing.
- **Verify in Phase 0:** that `getOutputTimestamp()` and `outputLatency` are available and sane in both Firefox and Chrome on the user's laptop. Record the findings in the Phase 0 file.

## Pitch representation

- Internally, a note is a **MIDI number** (0–127). Pitch class = `midi % 12`, with C = 0.
- Note **names** exist only at the display boundary, spelled by key context through `tonal` (E♭ in C minor, D♯ in E major).
- Chords and scales are stored as a **root pitch class plus an interval or quality id**, never as fixed note lists.
- Progressions are stored as **Roman numerals relative to a key**, so everything transposes for free.

## Core types (sketch; refine in Phase 0)

`InputSource` and `InputEvent` are implemented in `src/input/types.ts` (P0-T3) and `HarmonyAt` in `src/music/harmony.ts` (P1-T1); the rest is still a sketch.

```ts
type InputSource = "midi" | "computer" | "onscreen" | "sim";

type InputEvent =
  | { kind: "noteOn"; note: number; velocity: number /* 0..1 */; time: number /* perf ms */; source: InputSource }
  | { kind: "noteOff"; note: number; time: number; source: InputSource }
  | { kind: "pedal"; down: boolean; time: number; source: InputSource }          // CC64 >= 64 means down
  | { kind: "bend"; semitones: number; time: number; source: InputSource };      // laptop or pedal bend

type PedalMode = "sustain" | "bend" | "glideHold";

// Split keyboard (src/audio/zones.ts). The layout is stored; zones are derived from it.
interface KeyboardLayout { split: boolean; splitNote: number /* main sound's lowest key */; main: ZoneSound; left: ZoneSound }
interface ZoneSound { presetId: PresetId; octave: number }
interface Zone { id: "main" | "left"; lowNote: number; highNote: number; presetId: PresetId; transpose: number /* semitones */ }

interface HarmonyAt {       // what's sounding at a moment in a groove or song (src/music/harmony.ts, P1-T1)
  keyTonic: number;         // pitch class, e.g. 0 for C
  keyMode: "major" | "minor";
  rn: string;               // the progression's Roman numeral, e.g. "IV7"
  chordRoot: number;        // pitch class
  chordQuality: string;     // tonal chord type id, e.g. "m7", "7", "maj7", "m7b5"
  chordTones: number[];     // pitch classes, root first
  soloScale: number[];      // pitch classes for the chosen solo scale, tonic first
}
// Display strings ("C minor", "Fm7") are derived from these with tonal at the UI boundary.
```

## MIDI parsing facts

- Note-on with velocity 0 **is a note-off**. The YPT-380 only sends note-off this way (verified in P0-T2).
- Sustain pedal = Control Change 64. Values of 64 and above mean down. Some pedals are reversed (polarity), so offer an "invert pedal" setting. **Track CC64 per channel; the pedal is down if any channel is down.** The YPT-380 sends each pedal change on channels 1–3, and channel 3 always sends 0 (P0-T2). "Invert pedal" inverts that aggregate, never each channel (inverted per channel, the constant channel-3 zero reads as held forever). Implemented in `src/input/midi/parse.ts`.
- On disconnect, release every held note and the pedal, so nothing downstream sticks.
- Accept notes on all channels, and don't clamp to the 61-key range: transpose can shift notes outside 36–96.
- Drop Active Sensing (0xFE) and Clock (0xF8) first, before any other work; don't log them. The YPT-380 streams clock constantly, thousands of messages a minute. Ignore unused messages such as bank select, program change and other CCs; the keyboard sends a burst of them on every voice change.
- Handle devices being plugged in or out while the app runs (`MIDIAccess.onstatechange`).
- **Windows:** older MIDI drivers often let only one app open a device at a time. If no input arrives, tell the user to close other music software.
- **Firefox:** `navigator.requestMIDIAccess()` triggers a prompt to install an auto-generated site-permission add-on. Verified in P0-T2 (Firefox 160, device connected): the prompt appears on the first request, and after that access is granted without a prompt. It's untested with no device connected. Firefox delivers MIDI events about 25 ms after their timestamps (Chrome: 1–2 ms), so latency calibration is per browser.

## Simulated MIDI source (required)

Most implementation is done by AI, which cannot press keys. So from Phase 0 there is a `sim` input that:
- plays scripted `InputEvent` sequences (for example "Em triad held 500 ms at 0.8 velocity"),
- replays recorded fixtures: JSON files of **raw MIDI messages** (format `keyflow-midi-fixture` v1, `src/input/sim/fixture.ts`) captured from the real keyboard with the dev event inspector and stored in `tests/fixtures/`; replay runs them through the real MIDI parser,
- is exposed in dev builds as `window.__keyflow.inject(events)` for Playwright. "Dev builds" are the dev server and builds made with `KEYFLOW_DEV_TOOLS=true` (the Playwright build in `dist-e2e/`); the production build drops the code through a compile-time constant, and CI checks that it did.

Implemented in P0-T4: `src/input/sim/` and `src/dev/`.

Every graded feature (drills, comping, ear training) must be testable end-to-end through this source.

## Persistence

- Dexie database `keyflow` with versioned schema migrations. Never break existing user data.
- Tables (grow per phase): `settings`, `items` (skill items plus FSRS card state), `reviewLogs`, `sessions`, `takes`, `presets`, `songs` (Phase 5, metadata only unless the user opts into storing audio).
- **Settings (P0-T9):** `src/storage/db.ts` holds the database (version 1: `settings`, key → value rows, one row per setting, so a new setting needs no migration). `parseSettings` (`src/storage/settings.ts`) is the trust boundary: every stored field is checked and falls back to its default on its own. Only what differs from the defaults is stored (`toStored`, leaf by leaf; a setting at its default has no row), so a default changed in a later version still reaches users who never touched it. `src/state/settings.ts` (imported by `main.tsx` and the dev tools only) loads, applies through `audio.restore` (which also reaches a running engine), `midi.select` and `setInvertPedal`, `laptopBend.setKey` and the calibration store, and only then saves, debounced 300 ms, writing only the rows whose stored value changed. A setting changed while storage was still loading keeps the change (`mergeLoaded`). If storage can't be read, the app runs on defaults and saves nothing. Saved: layout, knobs, pedal and bend settings, invert pedal, bend key, the chosen MIDI input (the connection's `preferredId`, re-selected when that input appears), the calibration offset with its output-timestamp lead, and whether sound was started before.
- **Takes (P1-T7):** version 2 adds `takes` (`++id`), one row per take (`src/analysis/take.ts`, `TAKE_FORMAT` 1, checked by `parseTake` on load). Events are timed in ms from the transport's start as heard (`contextToPerfMs`), so a transport position is `tickAt(take, at)` at the take's tempo (the Groove card locks groove, key and tempo while recording). `src/state/takes.ts` records from the input bus while recording and replays through a production `createSimPlayer` started at the replay's own transport start (`SimPlayer.play(events, start)`); `GroovePlayer.play` returns the transport's start time for this. The piano roll is `src/ui/canvas/roll.ts`, drawn on a take change or resize.
- **Items and FSRS (P2-T1):** `src/practice/items.ts`, pure. An `Item` is an ID (`isItemId` checks the type and segment count from learning-design.md), its ts-fsrs 6 card (`DefaultScheduler()`: FSRS-7, no fuzz; the legacy `fsrs()` API is deprecated in 6), and its created and unlocked dates. `review(item, rating, attempt, now)` returns the rescheduled item and a `ReviewLog` (item, time, rating, response ms, hint level, wrong notes, and ts-fsrs's own revlog). Dexie version 3 (`src/storage/db.ts`) adds `items` (key `id`, indexed by `card.dueAt`) and `reviewLogs` (`++id`, indexed by `item` and `at`); rows keep their Dates, since IndexedDB stores them as they are. `recordAttempt` (`src/state/items.ts`) reads or creates the item, unlocks it if it was locked, reviews it and saves the item and log, all in one transaction; e2e drives it through `window.__keyflow.items`.
- **Recognition (P2-T2):** `src/analysis/recognize.ts`, pure. `createHeldNotes(pedalMode)` turns input events into the notes sounding now (released keys count while the pedal is down and the mode is Sustain). `checkChord(held, tones, mode)` compares pitch classes (root first) and says what's missing and extra; modes are `pcs` (default, any octave), `inversion` (lowest note is the nth tone) and `register` (exact MIDI notes). `detectChord` gives tonal's names for display ("G6", then "Em7/G"). `checkScale(played, target, opts)` judges notes in order (any octave by default, or exact), returns `partial` / `wrong` / `done` with the first slip's expected note, and with a `bpm` checks every gap against `SCALE_TIMING.tolerance` and reports the measured tempo.
- **Drills (P2-T3):** `src/practice/drills.ts`, pure. `drillOf(item, { build?, bpm? })` turns an item ID (`geo:`, `chord:`, `scale:`, and `rn:<key>:<major|minor>:<numeral>` for chord in key) into a prompt, its pitch classes or scale run, and `hintStart` (2 for Build it). `createAttempt(drill, shownAt)` takes each input event with the notes sounding after it and reports done, the time from the prompt to the right answer, the wrong notes, and one feedback line. Chords are judged from the first key going down after the prompt (then on releases and the pedal too, so lifting a wrong note can answer), so a chord still held from the last answer can't answer the next; a scale that slips or runs out of time starts again. `pickDrill` picks at random for practice by type, outside a session. `drills.handle` (`src/state/drills.ts`) is subscribed to the input bus in `main.tsx` after the audio engine, tracks held notes with `createHeldNotes`, and changes its store only when the feedback or the done state does. The canvas keyboard's highlighting is off while a drill is open, since it would show the answer. e2e opens a drill by item ID with `window.__keyflow.drill(item, opts)`.
- **Grading and hints (P2-T4):** `src/practice/grading.ts`, pure. `rate(attempt, targetOf(drill))` applies learning-design.md's table. Target times and the hint pace are in `GRADING`. A scale's target is a 2 s reaction allowance plus the run at its tempo, and only the allowance is halved for Easy. `hintDelays(stability, pacing, steps)` grows the first delay with log2 of FSRS stability up to a cap, then fixed steps. `hintsFor(drill)` is the ladder from `hintStart`, each step a line plus labelled keys. Find the note lights its key only at step 3, and chord in key anchors on the key's tonic. The drill store loads the item's stability when a drill starts (a stale load is dropped) and runs one timer for the next step. For a scale, the timer restarts on each right note, so a run in progress isn't a stall. A right answer, or a give-up (a new drill, Skip or Close once a key was pressed or a hint shown), is rated and recorded once through `recordAttempt`, which is imported on demand so the FSRS scheduler doesn't load at start. After a step-3 answer the drill is asked once more, unaided and unrecorded. The store's `rating` is there for the session builder (P2-T6). `OnscreenPiano` passes the hint's keys to `drawKeyboard`, which marks them as chord tones with their labels.
- **Curriculum (P2-T5):** `src/practice/curriculum.ts`, pure. `CURRICULUM` is a list of units (`id`, `track`, `title`, `items` in unlock order, `after` prerequisite units) in five tracks: geography, scales, triads, sevenths, chords in key. Items inside a unit run groove keys first (D, E♭, D♭, F), then the rest. `validateCurriculum` reports duplicate units, bad or repeated item IDs, unknown prerequisites and cycles. A unit is open when each prerequisite has at least `UNLOCK.share` (half) of its items unlocked with FSRS stability of `UNLOCK.stableDays` (7) or more; `unitProgress` is that share. `unlockNext(items, cap)` returns up to `UNLOCK.perSession` (3) item IDs to unlock, each slot from the track with the fewest unlocked items, so a session mixes tracks and none starves; an item offered as new gets its unlock date when it is first practised (`recordAttempt`), so one left unplayed is offered again next session, and the progress view (P2-T7) reads the graph. The thresholds are starting values.
- **Session builder (P2-T6):** `src/practice/session.ts`, pure. `buildSession(items, ratings, now, previous)` is the core session: unlocked items due by `now`, most overdue first and at most `SESSION.dueCap` (20), then `unlockNext`'s new items. Each part is `interleave`d: the fullest item type that isn't the last one shown goes next, so neighbours differ in type (geo, chord, scale, rn) wherever the mix allows, then in key, and the session never opens with the item shown just before it. `newItemCap(ratings)` is the adaptive part: over the last `SESSION.window` (20) ratings, a success rate (not Again) above 90% gives 4 new items, below 70% gives 2, otherwise 3, and fewer than 10 ratings count as neither. Scales drill at `SCALE_BPM`, and a new root-position or any-voicing chord is drilled as Build it. Rows no drill can play are skipped. `jamOf(session, GROOVES)` is the Apply offer: the last scale practised that a groove solos in, in its key. The store (`src/state/session.ts`) loads the items and the latest ratings (`loadRecentRatings`, on the `reviewLogs.at` index), imports the builder on demand like the scheduler, and feeds the drill store one drill at a time; Next and Skip in a session take the next one, and practice by type leaves the session. The Jam button sets the groove, key and scale and scrolls to the groove card.
- **Canvas keyboard (P0-T9):** `src/ui/OnscreenPiano.tsx` draws the 61 keys (MIDI 36–96) on a canvas and takes pointer input through the pure geometry in `src/ui/canvas/keys.ts`. It redraws in an animation frame after a note, layout or size change, reading a mutable held map and `getState().layout` there. e2e reaches keys through `window.__keyflow.pianoKey(note)`.
- **Export and import (P2-T8):** local-first means the user needs a backup path. The "Your data" card (`src/ui/DataPanel.tsx`) exports every table as one JSON file (`{ app: 'keyflow', version, exportedAt, settings, takes, items, reviewLogs }`, `version` being the database version, `db.verno`) and imports one. The format and its checks are pure, in `src/storage/backup.ts`, loaded on demand like the scheduler. An import is checked whole before anything is written (`parseBackup`): a file from a newer database is refused, takes go through `parseTake`, items and logs through `parseItem` and `parseReviewLog` (`src/practice/items.ts`; cards and revlogs are checked field by field against a fresh ts-fsrs card, Dates revived from their JSON strings), and one bad row or a repeated item ID rejects the file. Settings are read like stored ones, an invalid one falling back to its default. Exports go through the same checks, so the app always imports its own file. `replaceAll` (`src/storage/db.ts`) clears and writes all four tables in one transaction, so a failed write leaves the data as it was; then the page reloads so every store starts from the new data. Takes and logs get new ids. e2e reads the tables through `window.__keyflow.dump()`.
- **Progress view (P2-T7):** the Progress card (`src/ui/ProgressPanel.tsx`, lazy-loaded since the curriculum brings in the scheduler) draws what `src/practice/progress.ts` (pure) computes. `heatmap(items)` turns the curriculum's chord and scale items into rows (one per type and inversion) over 12 key columns (`KEYS`, chromatic from C, spelled as the item IDs spell them), grouped by track; geography, chords in key and items outside the curriculum (a random drill's `aug`) aren't in the grid. `levelOf` gives each item a level: locked (no row or not unlocked), new (unlocked, never reviewed), shaky (stability under `UNLOCK.stableDays`) or cold (at it), so "known cold" is what unlocks the next unit; `fill` is stability as a share of that line. `practiceDays` marks which of the last 14 local days have an attempt, and `daysRunning` counts the days in a row up to today, or up to yesterday while today has none yet, so a day not yet played never breaks it. `watchProgress` (`src/storage/db.ts`) reads every item and the attempt times since the window's start (the `at` index's keys, not whole rows) through Dexie's `liveQuery`, so the card updates after each recorded attempt and never per note.
