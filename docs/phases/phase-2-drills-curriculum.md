# Phase 2: Drills and Curriculum

**Status:** see `PLAN.md`. **Depends on:** Phase 0 (input, audio, storage); Phase 1 for "apply in jam". **Read first:** `CLAUDE.md`, [`../learning-design.md`](../learning-design.md) (required: items, grading, hint ladder, sessions), [`../architecture.md`](../architecture.md).

## Goal

Turn fragmented theory into automatic, on-the-keys knowledge. The user should be able to play any triad or scale they need **without thinking**, and **work out** anything they don't know yet. This is delivered as short, spaced, interleaved daily sessions.

## In scope
Skill item model, curriculum graph, drill types, grading, hint ladder, FSRS scheduling, session builder, progress view, data export and import.

## Out of scope
Comping and voicing drills in time (Phase 3), ear training (Phase 4), licks (Phase 6). Phase 2 builds the **engine** they all plug into.

---

## Tasks

Each task names the tasks it needs. Tasks whose dependencies are done can run at the same time (see "Parallel tasks" in `CLAUDE.md`): first P2-T1 and P2-T2, then P2-T3, P2-T5 and P2-T8, then P2-T4 and P2-T7, then P2-T6. The follow-ups run P2-T12 alone, then P2-T9, P2-T11 and P2-T13, then P2-T10, then P2-T14. **Model** is the session's: Sonnet for pure, spec-driven logic with table-driven tests; Opus for UI, storage, audio, grading and learning design.

### P2-T1: Item model and FSRS [done 2026-11-27]
**Depends on:** none. Adds the Dexie schema version for this phase; no other Phase 2 task changes the schema. **Model:** Opus.

- Item IDs as defined in `learning-design.md`. Each item stores its FSRS card state (`ts-fsrs`) and creation and unlock dates.
- Dexie tables `items` and `reviewLogs`. Every attempt is logged: item, rating, response time, hint level, wrong notes.
- **Automated:** rating → schedule round trip; persistence survives reload.
- **Built:** 2026-11-27. `src/practice/items.ts` (pure) and Dexie version 3 in `src/storage/db.ts` (see "Items and FSRS (P2-T1)" in `docs/architecture.md`). Cards are ts-fsrs 6's `DefaultScheduler` (FSRS-7, no fuzz), stored as returned. `items` is indexed by `card.dueAt` for the session builder, `reviewLogs` by `item` and `at` for the progress view. `recordAttempt(id, rating, attempt)` in `src/state/items.ts` is what P2-T4 calls once it grades; an item drilled before it has a row gets one, and a practised item counts as unlocked from then on. Unit tests in `src/practice/items.test.ts`; the reload and the version 2 → 3 upgrade in `tests/e2e/items.spec.ts`. There is no manual check.

### P2-T2: Chord and scale recognition from input [done 2026-11-27]
**Depends on:** none. **Model:** Sonnet.

- From held notes (sustain counted when the pedal is in Sustain mode), produce the set of pitch classes being played, then check it against the target:
  - triad or chord match by pitch-class set, octave-agnostic by default
  - optional strict modes: exact inversion (lowest note), exact register
  - scale drills: an ordered sequence of notes, checking order and, optionally, tempo
- Use `tonal` chord detection for display ("you played G6").
- **Automated:** table-driven tests covering every triad quality and inversion in all 12 keys, plus extra-note and missing-note cases.
- **Built:** 2026-11-27, `src/analysis/recognize.ts` (see "Recognition (P2-T2)" in `docs/architecture.md`). The table covers triads, sus2/sus4, aug, dim and four 7th qualities, every inversion, 12 roots, in all three chord modes. Scale drills take MIDI targets and compare in any octave by default; timing is per gap, with the tolerance in `SCALE_TIMING`.

### P2-T3: Drill types [done 2026-11-27]
**Depends on:** P2-T2. **Model:** Opus.

| Drill | Prompt | Correct when |
|---|---|---|
| Find the note | "F♯" | Any F♯ pressed |
| Play the chord | "E minor" / "Fm7, 1st inversion" | Pitch-class set (plus inversion if strict) matches |
| Play the scale | "A minor pentatonic, up one octave, at 70 BPM" | Ordered notes match, in time if a tempo is set |
| Chord in key | "The vi chord in G" | Plays E minor |
| Build it | "Build D minor from its formula" | As "play the chord", but the hint ladder starts at step 2 (method) |

- Prompts show **names and Roman numerals only**, never notation.
- **Automated:** each drill type end-to-end through the simulated source (Playwright).
- **Built:** 2026-11-27. The drills live in `src/practice/drills.ts` and the card in `src/ui/DrillPanel.tsx` (see "Drills (P2-T3)" in `docs/architecture.md`). Chord in key uses the new item type `rn:<key>:<major|minor>:<numeral>`. Build it shows the formula under the prompt from the start. Scale drills pick 70 BPM, with no click track. Drills are picked at random until P2-T6. The keyboard's highlighting is off while a drill is open. Each attempt reports its time, wrong notes and one feedback line for P2-T4. The e2e spec is `tests/e2e/drills.spec.ts`. There is no manual check, since every drill is driven by the simulated source.

### P2-T4: Grading and hint ladder [done 2026-11-27]
**Depends on:** P2-T1, P2-T3. **Model:** Opus.

- Implement the rating table and the hint ladder from `learning-design.md`. The delay before the first hint scales with FSRS stability.
- Target times live in config.
- **Automated:** grading unit tests; the hint delay increases with stability.
- **Manual:** hints feel helpful, not naggy.
- **Built:** 2026-11-27. `src/practice/grading.ts` (pure): `GRADING` holds the target times, the scale reaction allowance and three hint-pace profiles; `rate`, `targetOf`, `hintDelays` and `hintsFor`. The drill store (`src/state/drills.ts`) runs the hint timers from the item's stored stability, rates each finished or abandoned attempt and calls `recordAttempt` once. After the step-3 answer it asks once more, unaided and unrecorded. Hint keys are drawn on the canvas keyboard in place of the (drill-off) jam highlighting. The card shows the hint, the rating and one tip, with temporary **Hints: Quick / Steady / Patient** chips for the audition (Steady is the default until then). Unit tests in `src/practice/grading.test.ts`; e2e (the ladder under a fake clock, the retry, a saved rating, skip as Again) in `tests/e2e/drills.spec.ts`. Manual check: [`docs/manual-tests/P2-T4.md`](../manual-tests/P2-T4.md).

_Manual check results (2026-11-27, Chrome, YPT-380): step 1 pass. Hint pace taste: **Steady**, now the default; the pace chips are removed with the drills layout work. Step 3 pass, with one finding: the user doesn't yet know most chords, scales or inversions, so "Play the chord" and "Play the scale" have nothing to work it out from. That led to P2-T9 (played-chord indicator) and P2-T10 (chord and scale library)._

### P2-T5: Curriculum graph [done 2026-11-27]
**Depends on:** P2-T1. **Model:** Sonnet.

Tracks, each a sequence of units with prerequisites. Starting version, open to change:

1. **Geography:** white keys, then black keys with sharp and flat names.
2. **Soloing scales:** minor pentatonic (keys commonly used in the grooves first, then all 12), blues scale, Dorian, major pentatonic, Mixolydian.
3. **Triads:** major and minor in all 12 keys (fixes "C major yes, E minor no"), then diminished and sus, then inversions.
4. **7th chords:** m7, dom7, maj7 (this unlocks Phase 3 comping).
5. **Chords in key:** diatonic triads and 7ths by Roman numeral in common keys.

- An item unlocks when its prerequisites reach a stability threshold. At most 2–4 new items per session.
- Curriculum is data (a JSON or TS graph), not code.
- **Automated:** graph validation (no cycles, every prerequisite exists).
- **Built:** 2026-11-27. `src/practice/curriculum.ts` (see "Curriculum (P2-T5)" in `docs/architecture.md`): 19 units in the five tracks, as a TS list. A unit opens when each prerequisite has half its items stable (FSRS stability of 7 days or more, in `UNLOCK`), so 7th chords unlock once minor triads are stable in six keys. `unlockNext` returns up to 3 item IDs, mixing tracks; scale units use the `asc1` item only. Unit tests in `src/practice/curriculum.test.ts` (graph validation, every item makes a drill, unlock rules). There is no manual check.

### P2-T6: Session builder [done 2026-11-27]
**Depends on:** P2-T1, P2-T3, P2-T4, P2-T5. **Model:** Opus.

- **Core session (about 5 min):** due items first, **interleaved** (no item twice in a row; mixed types and keys), then new items.
- **Apply:** after the core, offer "jam with what you practiced", e.g. load a groove with today's scale selected.
- Adaptive difficulty: if the rolling success rate is above about 90%, add new items or strict modes; below about 70%, slow down new items. Both thresholds are config.
- **Automated:** session composition tests (interleaving, due-first, new-item cap).
- **Built:** 2026-11-27. `src/practice/session.ts` (pure) and the store `src/state/session.ts` (see "Session builder (P2-T6)" in `docs/architecture.md`). The Drills card's **Start today’s session** runs at most 20 due reviews, most overdue first, then `unlockNext`'s new items, each part interleaved by type, then key. `SESSION` holds the starting values: 4 new items above a 90% success rate (not Again, over the last 20 ratings), 2 below 70%, else 3. New items are unlocked when first practised, so one left unplayed comes back next session. A new chord is drilled as Build it. After the last drill, **Jam** sets the groove, key and solo scale from the last scale practised; sessions without a scale offer none. The type chips stay for practice by type until P2-T4's manual check, which uses them, is done. Strict modes don't adapt yet (a `shortcut:`). Unit tests in `src/practice/session.test.ts`; e2e in `tests/e2e/session.spec.ts`. There is no manual check.

### P2-T7: Progress view [done 2026-11-27]
**Depends on:** P2-T1, P2-T5. **Model:** Opus.

- Heatmap of keys × chord or scale types, colored by FSRS stability, showing what you know cold, what's shaky and what's new.
- Streak and consistency shown gently (see the feedback tone in `learning-design.md`).
- **Built:** 2026-11-27. The Progress card (`src/ui/ProgressPanel.tsx`) over `src/practice/progress.ts` (see "Progress view (P2-T7)" in `docs/architecture.md`, and "Progress (P2-T7)" in `DESIGN.md`). The heatmap is the curriculum's chord and scale items: 17 rows (type and inversion) under three tracks, 12 key columns. A cell is not open yet, new, shaky or known cold, and known cold is the curriculum's own stable line (`UNLOCK.stableDays`), so what reads as known is what unlocks the next unit. Every level is a shape as well as a tone of `bone`. Geography and chords in key have no keys × types grid, so they aren't shown. Practice days are the last 14 local days as dots and one line ("You practised on 5 of the last 14 days, 3 days in a row."), with no streak to lose. The card updates after each recorded attempt through Dexie's `liveQuery`. Three cell looks (Fill, Stickers, Tint) wait for one taste pick in [`docs/manual-tests/P2-T7.md`](../manual-tests/P2-T7.md). Unit tests in `src/practice/progress.test.ts`, the live update in `tests/e2e/progress.spec.ts`.

_Manual check results (2026-11-27, Chrome): the idea and the grid pass. Look taste: no preference, so **Fill** (the current default) stays and the look chips are removed with the layout work. The user finds the card, like the page, visually bland and wants it revisited together with navigation._

### P2-T8: Data export and import [done 2026-11-27]
**Depends on:** P2-T1. **Model:** Opus.

- Export all user data (settings, items, logs, takes) as a single JSON file. Import with a schema-version check.
- **Automated:** export → wipe → import round trip.
- **Built:** 2026-11-27. The "Your data" card (`src/ui/DataPanel.tsx`) has Export backup and Import backup; the format and its checks are in `src/storage/backup.ts` (see "Export and import (P2-T8)" in `docs/architecture.md`). The file carries the database version, and one from a newer version is refused. Every imported row is checked before anything is written, and one bad row rejects the whole file. The import asks before replacing, writes all four tables in one transaction, then reloads the page. Unit tests in `src/storage/backup.test.ts`; the round trip and the refused files in `tests/e2e/backup.spec.ts`. There is no manual check.

### P2-T9: Played-chord indicator, on by default [done 2026-11-27]
**Depends on:** P2-T12 (the label lives in the readout line above the pinned keyboard). **Model:** Opus.

Added 2026-11-27 from the P2-T4 check: the user can't yet name what they play, so the app names it for them.
- Whatever is held (pedal-sustained notes included, as `createHeldNotes` counts them) is named live beside the keyboard: the chord symbol with its inversion as a slash chord (`Em/G`), or the note name for one note, or the interval for two. Spelled by key. When a groove key is set, the Roman numeral in that key shows too (`vi`).
- Uses `detectChord` (`src/analysis/recognize.ts`, P2-T2). Updates on note changes through the store at most once per change, never per frame; the hot path rules hold.
- On by default, everywhere the keyboard is, drills included (it names what you played, not the target). One setting turns it off, saved with the settings.
- **Automated:** inject a chord, an inversion, a single note and a pedal-held chord through the simulated source; the label matches. Off setting hides it.
- **Manual:** none (the label is checked by e2e).
- **Built:** 2026-11-27. `nameHeld` in `src/analysis/recognize.ts` (pure, table-tested): one pitch class is its name, two an interval (lowest up, within the octave), three or more `detectChord`'s first candidate, a plain major triad shown as its root (`G/B`). The numeral is the root's degree from the major scale with the triad's case (`vi`, `vii°`, `♭VII`, no extensions), in the groove's key, and left out while a drill is open (it has its own key). The label leads the readout (`LiveInput`, written to the DOM in its frame after an input event, like the held notes). The setting `chordName` is in Setup's Computer keys card and saved with the settings. e2e in `tests/e2e/input.spec.ts` and `settings.spec.ts`.

### P2-T10: Chord and scale library
**Depends on:** P2-T9, P2-T12 (the library is the Learn view). **Model:** Opus.

Added 2026-11-27 from the P2-T4 check: something to look a chord or scale up in, so drills can be worked out rather than known.
- Pick a key and a chord type (the curriculum's triads and 7ths, plus sus and diminished) or a scale (the curriculum's soloing scales and modes). The keyboard shows it: chord tones labelled R, 3, 5 (b3, 7…) and note names, and for chords each inversion (root position, 1st, 2nd, and 3rd for 7ths), stepped with buttons or arrow keys.
- Shows the formula in half-steps (the same words "Build it" uses) and, for a key, its diatonic chords as Roman numerals, each one clickable.
- **Hear it:** plays the chord (block, then broken) or the scale up and down through the audio engine at a set tempo, using `Tone.immediate()` rules like every other trigger.
- **Drill this:** opens the matching drill for the item shown, in Practice. This is "practice by type" from now on: remove the drill-type chips (`pickDrill`) that P2-T12 kept.
- No notation. Content is generated from `tonal` and the curriculum's vocabulary, not hand-typed tables.
- **Automated:** for a sample of keys, types and inversions, the highlighted MIDI notes match `tonal`; Hear it schedules the right notes (dev inspector or the engine's test hook); Drill this opens the right item.
- **Manual:** taste only, if the layout has real alternatives (Taste in one round).

### P2-T11: Take feedback on the piano roll [built 2026-11-27, manual check pending]
**Depends on:** P2-T12 (it moves the Takes card; waiting avoids a conflict). **Model:** Opus.

Added 2026-11-27 from the P1-T8 check: show the take stats on the roll, not only as numbers.
- Each note on the take's piano roll is marked by what the stats count: a chord tone on beat 1 or 3, in the scale, or out of the scale (dimmed, never red). The strong beats and bar lines are visible behind the notes, and the longest rest is shaded.
- The one suggestion points at its evidence on the roll where it has some (the bar with no space, the first unused blue note's place).
- Hovering or tapping a stat highlights the notes it counts. The roll stays a canvas that reads state each frame.
- The categories come from `src/analysis/stats.ts` (pure), one source for the numbers and the marks.
- **Automated:** unit tests that every note gets exactly the category the stats count it under; an e2e take recorded through the simulated source shows the expected count per category.
- **Manual:** taste: the marking look (3 or 4 candidates, Taste in one round).
- **Built:** 2026-11-27. `noteMarks` in `src/analysis/stats.ts` flags each note (in the scale, on 1 or 3, chord tone) and `takeStats` counts from those flags, so the numbers and the marks share one source; the flags overlap (B over G7 in D minor pentatonic is a chord tone on 1 outside the scale). The roll (`src/ui/canvas/roll.ts`) draws notes at the time heard (the calibration shift the strong-beat stat uses), so a note marked on beat 1 sits on its line: notes outside the scale hollow in `line`, scale tones `bone-muted`, chord tones on 1 and 3 brightest, a tick at the head of other notes on 1 or 3; bar lines and beat 3 behind them, the longest rest shaded. Evidence (`evidence()`, pure): **space** outlines the busiest bar (most presses, the first on a tie); **blueNote** draws a dashed ghost at the blue note halfway between the first whole-tone step between the 4th and 5th, none if there is no such step; **land** and **scale** ring the notes they count; the others have none. Hovering, tapping or tabbing to a stat fades the notes it doesn't count; the roll reads the focus, look and size each frame and redraws only on a change. Four looks behind temporary chips (Fill, Dot, Ring, Kraft; default Fill), kept for the visit only. Unit tests in `src/analysis/stats.test.ts`; e2e in `tests/e2e/takes.spec.ts`. Manual check: [`docs/manual-tests/P2-T11.md`](../manual-tests/P2-T11.md).

### P2-T12: Views and navigation [built 2026-11-27, manual check pending]
**Depends on:** none. Runs alone: it rearranges `src/App.tsx` and every card. **Model:** Opus.

Added 2026-11-27 from the user's review and an Impeccable critique: one 4,700 px page of 11 cards, set-once settings among daily tools, drills fused to Play, and drill hints drawn on a keyboard scrolled off screen.
- **Three views** in a slim top bar: **Jam · Practice · Learn**, plus a gear for **Setup** and a setup sticker that shows only while setup is unfinished. Hash routes (`#/jam`…), so the back button works without a router dependency. A view-switch shortcut, if any, must not use Space (the bend key) or the computer-piano letters.
- **The keyboard is mounted once in the shell, pinned at the bottom of every view,** never remounted, still reading state each frame. One readout line above it (held notes, pedal; P2-T9 adds the chord name). Its zone strip opens that zone's sounds in a drawer.
- **Jam:** a transport strip (Play, Record, groove, key, tempo) right above the readout; "Training wheels" and "Look" merged into one control named "Help on the keys"; Mix and Takes in drawers. The groove keeps playing across views, with a small stop button in the top bar.
- **Practice:** a placeholder that holds today's Drills card as it is (P2-T13 designs it), with the hint-pace chips removed (Steady) and the drill-type chips tucked behind "Practice by type" until P2-T10's Drill this replaces them.
- **Learn:** a placeholder for P2-T10.
- **Setup (gear):** Keyboard, Sounds (the full sleeves and sliders), Pedal & bend, Timing, Your data, the split and the computer-key help (shown open only while no MIDI device is connected).
- **First visit:** a short full-screen walk-through, Keyboard then Sound, one yellow action per screen, landing on Jam. Timing is offered before the first timed drill instead. Whether one gesture can both start audio and request MIDI in Firefox is unverified: check it, don't assume.
- Progress's look chips go (Fill stays). Progress moves to Practice's start screen in P2-T13; until then it sits in Practice under the Drills card.
- Design it with the `impeccable` skill in the current theme; the visual refresh is P2-T14, so no theme changes here.
- **Automated:** update the e2e specs to navigate by view; one spec walks every view and checks the keyboard canvas is the same element throughout, and that a playing groove survives a view switch; the first-visit flow reaches Jam.
- **Manual:** must-pass: on the user's laptop, in Jam and Practice, the whole keyboard and the controls in use fit on screen together without scrolling. Taste: none.
- **Built:** 2026-11-27. Hash routes in `src/state/route.ts` (an empty hash opens the walk-through until sound has run here, else Jam; leaving Practice closes an open drill, leaving Setup cancels split learning and a tap test). The shell (`src/App.tsx`): top bar, the view, and the dock (`src/ui/Dock.tsx`: Jam's transport, the readout line, the one keyboard, the sound drawer). Walk-through in `src/ui/Welcome.tsx`: the press on Connect also starts audio (the page-wide unlock); whether Firefox allows both from that one press is manual step 4, and the Sound screen's Start audio covers it if not. Help on the keys is one select over the saved wheels and look. Pace and Progress look chips removed; drill-type chips behind Practice by type; a timed scale drill opened before calibration offers Timing. No view-switch shortcut. e2e: `tests/e2e/views.spec.ts` plus every spec navigating by view. Manual check: [`docs/manual-tests/P2-T12.md`](../manual-tests/P2-T12.md).

### P2-T13: Practice screen
**Depends on:** P2-T12. **Model:** Opus.

- **Start screen:** the practice days, the progress grid (an empty state that invites a first session instead of 204 dashed squares) and one yellow "Start today's session".
- **During a drill:** the prompt in large type directly above the pinned keyboard, the hint and result lines under it, Skip and Close, and the session's progress as dots. Only one yellow action on screen at a time: "Start today's session" hides while a drill is open.
- Hints drawn on the keyboard are always visible while a drill is open (the reason this task exists).
- After the session, the Jam offer from P2-T6 sits where the prompt was.
- **Automated:** e2e: a session through the simulated source; the prompt and the keyboard are both in the viewport at 1280×720 and at the user's laptop size; hint marks appear on the visible keyboard.
- **Manual:** taste only, if the layout has real alternatives (Taste in one round).

### P2-T14: Visual refresh
**Depends on:** P2-T10, P2-T11, P2-T13 (every screen exists). **Model:** Opus.

- Taste in one round on the real screens: 3 directions, selectable in the app. (1) **Crate Dig pushed:** the keyboard as a full-width stage, the active sound's colour as a field behind it, the display face on the drill prompt and the chord name, Progress as a crate of sleeves. (2) **After hours:** full-bleed black, colour only as light. (3) **Liner notes:** large editorial type, sparse. All stay dark.
- Rule changes in `DESIGN.md` (the display face beyond card tabs; new colours for progress states, since sound colours are reserved) are the user's call and are part of the pick.
- The pick becomes the theme, `DESIGN.md` is updated, and the other directions are removed in the same task.
- **Manual:** taste: the pick.

---

## Open questions
- Should scale drills require a set fingering? (MIDI can't see fingers, so the app can only suggest one.)
- Order of keys for new items: circle of fifths, or the keys the grooves use first? (Recommended: groove keys first, for immediate payoff in jam mode.)
- Should strict inversion mode be on by default once the root positions are stable?

## Done when
The user does a daily 5-minute session that serves due chords and scales interleaved, grades speed and accuracy, fades hints over days, and shows visible progress. Asked "E minor?", they play it instantly.
