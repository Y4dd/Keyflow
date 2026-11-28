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

Each phase file stands alone: goal, scope, tasks with IDs and acceptance criteria, open questions and done-when. Each session takes **one task ID**. Tasks run in the order listed unless their `Depends on:` lines let several run at once (see "Parallel tasks" in `CLAUDE.md`).

**Task status** is tracked in each phase file by adding a marker after the task heading, e.g. `### P0-T3: Input bus and MIDI layer [done 2026-12-01]` or `[in progress]`, or `[built 2026-12-01, manual check pending]` when only the user's manual check is left. Headings with no marker are not started. This table tracks phase-level status.

| # | Phase | Status | File |
|---|---|---|---|
| 0 | Foundation: hardware check, MIDI, synth, split, pedal, latency | Done (2026-11-25) | [phase-0-foundation.md](docs/phases/phase-0-foundation.md) |
| 1 | Jam mode: grooves, highlighting, record and replay | Done (2026-11-27) | [phase-1-jam-mode.md](docs/phases/phase-1-jam-mode.md) |
| 2 | Drills and curriculum: spaced review, soloing scales, chords | In progress (P2-T1 to P2-T10 and P2-T13 done; P2-T11, P2-T12 built, manual checks pending; P2-T14 next) | [phase-2-drills-curriculum.md](docs/phases/phase-2-drills-curriculum.md) |
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
| [P2-T12](docs/manual-tests/P2-T12.md) | 1, 2, 3, 4 | none | none | Chrome, Firefox | 5 |
| [P2-T11](docs/manual-tests/P2-T11.md) | none | 1, 2, 3 | none | Chrome | 5 |

---

## Decisions log

Newest last. Format: `YYYY-MM-DD: decision. Reason.` This log holds the current phase and anything newer. When a phase is done, the Main Agent moves its entries to `docs/decisions/phase-N.md`, where they stay in force: grep there for the area a task touches. Archived so far: [Phase 0 and the workflow before it](docs/decisions/phase-0.md), [Phase 1](docs/decisions/phase-1.md).

- 2026-11-26: **A faster workflow (the user's request, "we feel slow").** (1) Task sessions run in their own worktrees, up to three at once when the phase file's `Depends on:` lines allow and they share no hot spot (a Dexie version, `package.json`, the same component or engine file); they land by rebase and fast-forward push. (2) Only the Main Agent edits `PLAN.md`: a task's report carries its queue row and decisions-log lines, and the Main Agent applies them. (3) The Main Agent starts every task that can run while the user is present, since the app refuses `start_session` on automated turns. (4) Sessions read only their own task's section of the phase file; finished phases' decisions move to `docs/decisions/` (Phase 0's now, Phase 1's when it closes), which cut `PLAN.md` from 43 KB to about 26 KB. (5) Locally, the checks run the e2e specs a change touches, in Chromium (plus Firefox for audio, MIDI or timing changes), and the whole suite only for shared code; CI stays the full gate in both browsers. (6) The review subagent runs on Sonnet unless the diff touches audio, input, storage, timing or grading, or is over about 300 lines. (7) Taste results get 3 or 4 candidates in one audition instead of one at a time. (8) Pushes that change only `docs/**` or root `*.md` start no CI run.
- 2026-11-26: **Workflow, round 2.** Phase 1 decisions up to P1-T7 moved to `docs/decisions/phase-1.md`, so `PLAN.md` is about 8 KB. Each Phase 2 task names its session model (`**Model:**`: Sonnet for P2-T2 and P2-T5, pure and table-tested; Opus for the rest). On the user's turn the Main Agent may start tasks whose dependencies haven't landed: each waits in one background `until` loop on `origin/main`'s phase markers, so one click covers a phase. Before starting sessions it reads the plan limits and starts one session instead of a wave above about 70% of the 5-hour or weekly limit (the account is on Pro: on 2026-11-26 the weekly limit was 73% used with 1.5 days left).
- 2026-11-27: **P2-T2 recognition.** Pure module `src/analysis/recognize.ts`. Chords match by pitch-class set (any octave) by default, with strict `inversion` (lowest note is the nth tone) and `register` (exact MIDI notes). Scale runs are an ordered MIDI target compared in any octave by default (the first note must be the root's pitch class), or exact. With a tempo set, every gap between notes must be within ±35% of the target gap (`SCALE_TIMING`, a starting value), and the measured tempo is reported for grading (P2-T4). Sustain counts only in Sustain pedal mode.
- 2026-11-27: **P2-T3 drill types.** "Chord in key" has its own item type, `rn:<key>:<major|minor>:<numeral>` (e.g. `rn:G:major:vi`, `rn:A:minor:bVII`), added to `learning-design.md`. "Build it" is a chord item drilled with `{ build: true }`: its formula ("Minor: root, +3 half-steps, +4 half-steps") shows under the prompt from the start, which is how its hint ladder starts at step 2. Scale drills default to 70 BPM, with no click track yet. Until the session builder (P2-T6) exists, drills are picked at random from a fixed vocabulary (no 9ths), never the same item twice in a row. A chord is judged from the first key going down after the prompt, then on releases and the pedal too, so a chord still held from the last answer can't answer the next. A scale that slips or runs out of time starts again. The keyboard's chord and scale highlighting is off while a drill is open, since it would show the answer. Each attempt reports its time, wrong notes and one feedback line; ratings and hints are P2-T4's.
- 2026-11-27: **P2-T1 items and FSRS.** Cards use ts-fsrs 6's `DefaultScheduler()` (FSRS-7, no fuzz), since the legacy `fsrs()`/`createEmptyCard` API is deprecated in 6. Cards are stored as the scheduler returns them, Dates included. Dexie version 3, the only Phase 2 schema change, adds `items` (`id`, indexed by `card.dueAt`) and `reviewLogs` (`++id`, indexed by `item` and `at`). Each log keeps the item, time, rating, response ms, hint level, wrong notes and ts-fsrs's own revlog. `recordAttempt` (`src/state/items.ts`) is the entry point for P2-T4. An item practised before it has a row gets one, and a practised item counts as unlocked from then on. Stored item rows aren't validated on load, so P2-T8's import must check what it imports.
- 2026-11-27: **P2-T5 curriculum graph.** `src/practice/curriculum.ts`: 19 units in five tracks as TS data. A unit opens when each prerequisite has half its items unlocked with FSRS stability of 7 days or more (`UNLOCK`, starting values), which gives "7th chords after minor triads stable in about six keys". `unlockNext` returns at most 3 new item IDs per session, each slot from the track with the fewest unlocked items so none starves. Groove keys (D, E♭, D♭, F) come first within a unit. Scale units use the `asc1` item only. Chords in key use the four groove-key and common-key tonics per mode, in the P2-T3 numeral vocabulary.
- 2026-11-27: **P2-T8 data export and import.** One JSON file (`app: 'keyflow'`, `version` = the database version, settings, takes, items, review logs), from the "Your data" card. An import is checked whole before anything is written: one bad row or a repeated item ID rejects the file, and a file from a newer database version is refused. Cards are checked by kind against a fresh ts-fsrs card and then by a trial review. Settings fall back to defaults as on load. All four tables are replaced in one transaction, then the page reloads. Exports pass the same checks, so the app always imports its own file. A new field on review logs must be added to `parseReviewLog` (`src/practice/items.ts`), or exports drop it.
- 2026-11-27: **P2-T4 grading and hints.** `src/practice/grading.ts` (pure). `GRADING` holds the target times (note 2 s, triad 3 s, 7th 4 s; 9ths 5 s, a shortcut) and three hint paces: Quick, Steady and Patient, with a first hint after 4, 6 or 10 s for a new item, ×(1 + log2(1 + stability)), capped, then fixed steps. Temporary chips choose the pace until the P2-T4 audition; Steady is the default until then. A scale's target is a 2 s reaction allowance plus its run at the drill's tempo. Only the allowance is halved for Easy, since the gaps are held to the tempo. For a scale, the stall timer restarts on each right note. A new drill, Skip or Close records Again (ms null), but only once a key was pressed or a hint shown, so skipping an untouched random drill records nothing. After a step-3 answer the drill asks once more, unaided and unrecorded. The store's `rating` is there for P2-T6.
- 2026-11-27: **P2-T4 hint ladder by drill kind** (a reading of learning-design.md). "Build it"'s formula is part of its prompt, so it isn't logged as a hint; the ladder shows from step 2, and the level stays 0 until a hint actually appears. Find the note has no anchor that isn't the answer, so step 1 anchors on C (F for C itself) and the key lights only at step 3. Chord in key anchors on the key's tonic, since the chord's root would answer the riddle. A scale's step 2 names the half-steps but marks only the root. Hint keys are drawn on the canvas keyboard in place of the jam highlighting, which is off during drills.
- 2026-11-27: **P2-T7 progress view.** The Progress card (`src/practice/progress.ts`, pure; `src/ui/ProgressPanel.tsx`, lazy-loaded because the curriculum loads the FSRS scheduler) shows the curriculum's chord and scale items as 17 type rows by 12 key columns. Levels: not open yet, new (never reviewed), shaky (stability under `UNLOCK.stableDays`) and known cold (at it), so the heatmap agrees with unlocking. Each level is a bone-tone shape, and known cold always wears a check. Geography and chords in key aren't in the grid. Practice days: the last 14 local days as dots plus one line, with no streak to lose (a day not yet played doesn't end the run). `watchProgress` (`src/storage/db.ts`) uses Dexie's `liveQuery`, so the card refreshes after each recorded attempt. Three cell looks (Fill, Stickers, Tint) wait for one taste pick, and the pick becomes the only look.
- 2026-11-27: **P2-T6 session builder.** `src/practice/session.ts` (pure) and `src/state/session.ts`. A core session is at most 20 due reviews (`SESSION.dueCap`), most overdue first, then `unlockNext`'s new items, each part interleaved (fullest type that isn't the last shown, then another key; never opening with the item just shown). New items per session follow the success rate (not Again) over the last 20 ratings: 4 above 90%, 2 below 70%, else 3; under 10 ratings counts as neither. A new item is unlocked when first practised, so one left unplayed comes back next session. New root-position or any-voicing chords are drilled as Build it; scales at 70 BPM. After the last drill, Jam sets the groove, key and solo scale from the last scale practised that a groove offers; sessions without one offer none. Strict modes don't adapt yet. The type chips (`pickDrill`) stay for practice by type until P2-T4's manual check, which uses them, has passed.
- 2026-11-27: **Checks for P1-T8, P2-T4 and P2-T7 passed.** Hint pace: Steady (the default). Progress look: Fill stays (the user had no preference). The temporary pace and look chips, and the drill-type chips P2-T6 kept for the P2-T4 check, are removed by the layout work.
- 2026-11-27: **Phase 2 extended with follow-ups from the checks** (the user's requests). P2-T9 names whatever is played, on by default. P2-T10 adds a chord and scale library (inversions, formulas, diatonic chords, hear it, drill it), because the user doesn't yet know most chords and scales and the drills assume they can work them out. P2-T11 marks the take stats on the piano roll. The user also finds the drills card fused with Play and bulky, the one long page hard to navigate, and the look bland: layout, navigation and a visual refresh are added once the user picks an approach.
- 2026-11-27: **Layout: three views and a setup gear** (the user's pick, after the Main Agent's review and an Impeccable critique). **Jam · Practice · Learn** in a slim top bar, Setup behind a gear with a first-visit walk-through, and one keyboard mounted in the shell, pinned at the bottom of every view, with a readout line above it. Structure before looks: the visual refresh (P2-T14) is a taste round of three directions on the finished screens, and the critique recommends pushing Crate Dig rather than replacing it. The open drill's hints were drawn on a keyboard scrolled off screen, which P2-T12 and P2-T13 fix. Tasks: P2-T12 views and navigation, P2-T13 the Practice screen, P2-T14 the visual refresh; P2-T9, P2-T10 and P2-T11 now wait for P2-T12.
- 2026-11-27: **P2-T12 views.** Hash routes live in `src/state/route.ts`. With no hash in the address, the app waits for the saved settings, then opens the walk-through if sound has never run here, otherwise Jam. An unknown hash goes to Jam. The keyboard, readout and Jam's transport sit in a dock mounted once (`src/ui/Dock.tsx`).
- 2026-11-27: **Leaving a view ends its modes.** Leaving Practice closes an open drill or session, the same as Close drills, so it records Again once a key was pressed or a hint shown. Leaving Setup cancels split learning and a running tap test. The groove keeps playing across views, with a "Stop groove" button in the top bar.
- 2026-11-27: **Walk-through.** Screens move only on Next, never when a status changes, because the press on Connect also starts sound. Whether Firefox allows both from that one press is P2-T12's manual step 4. Timing isn't in the walk-through: it is offered as a hint when a timed scale drill opens uncalibrated.
- 2026-11-27: **Help on the keys** is one select: Tags with names, Tags, Spotlight with names, Spotlight, Chord tones only, Off. It sets the existing training-wheels level and the saved look, so stored settings don't change. There is no view-switch shortcut.
- 2026-11-27: **P2-T9 chord label.** `nameHeld` in `src/analysis/recognize.ts` names what's held: one note's name, two notes' interval (within the octave), or the chord from `detectChord` as a slash chord, with a plain major triad shown as its root (`G/B`). The Roman numeral is the root's degree counted from the major scale, lowercase for minor (`vi`, `vii°`, `♭VII`, no 7ths or other extensions). It uses the groove's key and is left out while a drill is open, since the drill has its own key. The label goes straight into the page with the held notes, once per input event. It doesn't go through a store, so it's still never per frame and never a React re-render. After a change of key, groove, pedal mode or drill, it catches up at the next note. The setting `chordName` (on by default) is in Setup's Computer keys card and is saved with the settings.
- 2026-11-27: **P2-T11 roll marks.** The stats count from per-note flags (noteMarks: in the scale, on 1 or 3, chord tone), and the roll draws those same flags, so the numbers and the marks can't disagree. The flags overlap: B over G7 in D minor pentatonic is a chord tone on beat 1 but outside the scale. Notes are drawn at the time heard (the calibration shift the strong-beat stat uses), so a note marked on beat 1 sits on its line. Where each suggestion's evidence goes on the roll: space → the busiest bar (most presses; the first on a tie); blueNote → a dashed ghost at the blue note, halfway through the first whole-tone step between the 4th and the 5th, or nothing if there's no such step; land and scale → rings around the notes they count; the others have no evidence. Four looks wait for the taste pick (Fill, Dot, Ring, Kraft); the chosen one stays and the chips go.
- 2026-11-27: **P2-T13 Practice screen.** Two states: a start screen (the Drills card with the one yellow Start, then Progress, whose legend and grid give way to one line until a chord or scale is open), and a drill stage at the bottom of the view, right above the pinned keys, while a drill is open or the session has just ended. The stage's top row holds the session's dots (done solid, now a ring, to come dashed) or the type chips, with Skip and Close, so the tallest drill (a timed scale with the timing offer, at hint 3) fits at 1280×720. 1536×730 is tested as a stand-in for a 1080p laptop at 125%. No taste round: the layout was fixed by fit, not taste.
- 2026-11-27: **P2-T10 chord and scale library.** Learn lists the curriculum's triads (min, maj, dim, sus2, sus4), 7ths (m7, 7, maj7) and soloing scales, and every root position opens the curriculum's own item (`:root` triads, `:any` 7ths, `asc1` scales), so Drill this never makes a second FSRS row. A chord or scale shown with a minor third uses the minor key for its diatonic triads, otherwise the major key. A chip keeps the key's spelling and drills the curriculum's item for that pitch class. Shapes are lifted by octaves above the split so the main sound plays them. Hear it plays at 100 BPM in eighths through the input bus. The drill-type chips are removed; outside a session, Skip and Next return to Learn.

---

## Open questions

- Per-phase open questions are listed in each phase file.