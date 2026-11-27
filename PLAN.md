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
| 1 | Jam mode: grooves, highlighting, record and replay | In progress (all tasks built; P1-T8 manual check pending) | [phase-1-jam-mode.md](docs/phases/phase-1-jam-mode.md) |
| 2 | Drills and curriculum: spaced review, soloing scales, chords | In progress (P2-T1, P2-T2, P2-T3, P2-T5 done) | [phase-2-drills-curriculum.md](docs/phases/phase-2-drills-curriculum.md) |
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
| [P1-T8](docs/manual-tests/P1-T8.md) | 1, 2 | 3 | none | Chrome | 4 |

---

## Decisions log

Newest last. Format: `YYYY-MM-DD: decision. Reason.` This log holds the current phase and anything newer. When a phase is done, the Main Agent moves its entries to `docs/decisions/phase-N.md`, where they stay in force: grep there for the area a task touches. Archived so far: [Phase 0 and the workflow before it](docs/decisions/phase-0.md), [Phase 1 up to P1-T7](docs/decisions/phase-1.md).

- 2026-11-26: **P1-T8 take stats.** Worked out when a take is shown, never stored (no migration). **Strong beats are beats 1 and 3**, and the stat is **of the notes starting on them, the share that are chord tones** of the chord on that beat (a note a hair early on a change meets the new chord), shown with its count; count-in notes don't count. "On the beat" means within **an eighth of a beat** (62 ms at 120 BPM) as heard: the note's time less the take's calibration offset, plus the take's clock lead, less the lead the offset was measured under (without a calibration, the raw time). The rest is the longest time with every key up between the first and last press. Left-hand notes count in the range and the scale %, and a rest held with the sustain pedal still counts as a rest, since the take doesn't store the split or the pedal mode. **One suggestion**, the first rule that applies: fewer than 8 notes, no bar of space in a take over 4 bars, the blue note unused in minor blues, under half of 4+ strong-beat notes on chord tones, everything within a fifth, under 70% in the scale; otherwise a phrasing idea (repeat a short idea, change its ending). Thresholds are starting values in `SUGGEST` (`src/analysis/stats.ts`). No score and no good-or-bad colours: label-over-value pairs at body size and one sentence (DESIGN.md, Takes).
- 2026-11-26: **A faster workflow (the user's request, "we feel slow").** (1) Task sessions run in their own worktrees, up to three at once when the phase file's `Depends on:` lines allow and they share no hot spot (a Dexie version, `package.json`, the same component or engine file); they land by rebase and fast-forward push. (2) Only the Main Agent edits `PLAN.md`: a task's report carries its queue row and decisions-log lines, and the Main Agent applies them. (3) The Main Agent starts every task that can run while the user is present, since the app refuses `start_session` on automated turns. (4) Sessions read only their own task's section of the phase file; finished phases' decisions move to `docs/decisions/` (Phase 0's now, Phase 1's when it closes), which cut `PLAN.md` from 43 KB to about 26 KB. (5) Locally, the checks run the e2e specs a change touches, in Chromium (plus Firefox for audio, MIDI or timing changes), and the whole suite only for shared code; CI stays the full gate in both browsers. (6) The review subagent runs on Sonnet unless the diff touches audio, input, storage, timing or grading, or is over about 300 lines. (7) Taste results get 3 or 4 candidates in one audition instead of one at a time. (8) Pushes that change only `docs/**` or root `*.md` start no CI run.
- 2026-11-26: **Workflow, round 2.** Phase 1 decisions up to P1-T7 moved to `docs/decisions/phase-1.md`, so `PLAN.md` is about 8 KB. Each Phase 2 task names its session model (`**Model:**`: Sonnet for P2-T2 and P2-T5, pure and table-tested; Opus for the rest). On the user's turn the Main Agent may start tasks whose dependencies haven't landed: each waits in one background `until` loop on `origin/main`'s phase markers, so one click covers a phase. Before starting sessions it reads the plan limits and starts one session instead of a wave above about 70% of the 5-hour or weekly limit (the account is on Pro: on 2026-11-26 the weekly limit was 73% used with 1.5 days left).
- 2026-11-27: **P2-T2 recognition.** Pure module `src/analysis/recognize.ts`. Chords match by pitch-class set (any octave) by default, with strict `inversion` (lowest note is the nth tone) and `register` (exact MIDI notes). Scale runs are an ordered MIDI target compared in any octave by default (the first note must be the root's pitch class), or exact. With a tempo set, every gap between notes must be within ±35% of the target gap (`SCALE_TIMING`, a starting value), and the measured tempo is reported for grading (P2-T4). Sustain counts only in Sustain pedal mode.
- 2026-11-27: **P2-T3 drill types.** "Chord in key" has its own item type, `rn:<key>:<major|minor>:<numeral>` (e.g. `rn:G:major:vi`, `rn:A:minor:bVII`), added to `learning-design.md`. "Build it" is a chord item drilled with `{ build: true }`: its formula ("Minor: root, +3 half-steps, +4 half-steps") shows under the prompt from the start, which is how its hint ladder starts at step 2. Scale drills default to 70 BPM, with no click track yet. Until the session builder (P2-T6) exists, drills are picked at random from a fixed vocabulary (no 9ths), never the same item twice in a row. A chord is judged from the first key going down after the prompt, then on releases and the pedal too, so a chord still held from the last answer can't answer the next. A scale that slips or runs out of time starts again. The keyboard's chord and scale highlighting is off while a drill is open, since it would show the answer. Each attempt reports its time, wrong notes and one feedback line; ratings and hints are P2-T4's.
- 2026-11-27: **P2-T1 items and FSRS.** Cards use ts-fsrs 6's `DefaultScheduler()` (FSRS-7, no fuzz), since the legacy `fsrs()`/`createEmptyCard` API is deprecated in 6. Cards are stored as the scheduler returns them, Dates included. Dexie version 3, the only Phase 2 schema change, adds `items` (`id`, indexed by `card.dueAt`) and `reviewLogs` (`++id`, indexed by `item` and `at`). Each log keeps the item, time, rating, response ms, hint level, wrong notes and ts-fsrs's own revlog. `recordAttempt` (`src/state/items.ts`) is the entry point for P2-T4. An item practised before it has a row gets one, and a practised item counts as unlocked from then on. Stored item rows aren't validated on load, so P2-T8's import must check what it imports.
- 2026-11-27: **P2-T5 curriculum graph.** `src/practice/curriculum.ts`: 19 units in five tracks as TS data. A unit opens when each prerequisite has half its items unlocked with FSRS stability of 7 days or more (`UNLOCK`, starting values), which gives "7th chords after minor triads stable in about six keys". `unlockNext` returns at most 3 new item IDs per session, each slot from the track with the fewest unlocked items so none starves. Groove keys (D, E♭, D♭, F) come first within a unit. Scale units use the `asc1` item only. Chords in key use the four groove-key and common-key tonics per mode, in the P2-T3 numeral vocabulary.

---

## Open questions

- Per-phase open questions are listed in each phase file.