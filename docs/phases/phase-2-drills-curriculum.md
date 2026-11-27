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

Each task names the tasks it needs. Tasks whose dependencies are done can run at the same time (see "Parallel tasks" in `CLAUDE.md`): first P2-T1 and P2-T2, then P2-T3, P2-T5 and P2-T8, then P2-T4 and P2-T7, then P2-T6. **Model** is the session's: Sonnet for pure, spec-driven logic with table-driven tests; Opus for UI, storage, audio, grading and learning design.

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

### P2-T4: Grading and hint ladder [built 2026-11-27, manual check pending]
**Depends on:** P2-T1, P2-T3. **Model:** Opus.

- Implement the rating table and the hint ladder from `learning-design.md`. The delay before the first hint scales with FSRS stability.
- Target times live in config.
- **Automated:** grading unit tests; the hint delay increases with stability.
- **Manual:** hints feel helpful, not naggy.
- **Built:** 2026-11-27. `src/practice/grading.ts` (pure): `GRADING` holds the target times, the scale reaction allowance and three hint-pace profiles; `rate`, `targetOf`, `hintDelays` and `hintsFor`. The drill store (`src/state/drills.ts`) runs the hint timers from the item's stored stability, rates each finished or abandoned attempt and calls `recordAttempt` once. After the step-3 answer it asks once more, unaided and unrecorded. Hint keys are drawn on the canvas keyboard in place of the (drill-off) jam highlighting. The card shows the hint, the rating and one tip, with temporary **Hints: Quick / Steady / Patient** chips for the audition (Steady is the default until then). Unit tests in `src/practice/grading.test.ts`; e2e (the ladder under a fake clock, the retry, a saved rating, skip as Again) in `tests/e2e/drills.spec.ts`. Manual check: [`docs/manual-tests/P2-T4.md`](../manual-tests/P2-T4.md).

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

### P2-T6: Session builder
**Depends on:** P2-T1, P2-T3, P2-T4, P2-T5. **Model:** Opus.

- **Core session (about 5 min):** due items first, **interleaved** (no item twice in a row; mixed types and keys), then new items.
- **Apply:** after the core, offer "jam with what you practiced", e.g. load a groove with today's scale selected.
- Adaptive difficulty: if the rolling success rate is above about 90%, add new items or strict modes; below about 70%, slow down new items. Both thresholds are config.
- **Automated:** session composition tests (interleaving, due-first, new-item cap).

### P2-T7: Progress view [built 2026-11-27, manual check pending]
**Depends on:** P2-T1, P2-T5. **Model:** Opus.

- Heatmap of keys × chord or scale types, colored by FSRS stability, showing what you know cold, what's shaky and what's new.
- Streak and consistency shown gently (see the feedback tone in `learning-design.md`).
- **Built:** 2026-11-27. The Progress card (`src/ui/ProgressPanel.tsx`) over `src/practice/progress.ts` (see "Progress view (P2-T7)" in `docs/architecture.md`, and "Progress (P2-T7)" in `DESIGN.md`). The heatmap is the curriculum's chord and scale items: 17 rows (type and inversion) under three tracks, 12 key columns. A cell is not open yet, new, shaky or known cold, and known cold is the curriculum's own stable line (`UNLOCK.stableDays`), so what reads as known is what unlocks the next unit. Every level is a shape as well as a tone of `bone`. Geography and chords in key have no keys × types grid, so they aren't shown. Practice days are the last 14 local days as dots and one line ("You practised on 5 of the last 14 days, 3 days in a row."), with no streak to lose. The card updates after each recorded attempt through Dexie's `liveQuery`. Three cell looks (Fill, Stickers, Tint) wait for one taste pick in [`docs/manual-tests/P2-T7.md`](../manual-tests/P2-T7.md). Unit tests in `src/practice/progress.test.ts`, the live update in `tests/e2e/progress.spec.ts`.

### P2-T8: Data export and import [done 2026-11-27]
**Depends on:** P2-T1. **Model:** Opus.

- Export all user data (settings, items, logs, takes) as a single JSON file. Import with a schema-version check.
- **Automated:** export → wipe → import round trip.
- **Built:** 2026-11-27. The "Your data" card (`src/ui/DataPanel.tsx`) has Export backup and Import backup; the format and its checks are in `src/storage/backup.ts` (see "Export and import (P2-T8)" in `docs/architecture.md`). The file carries the database version, and one from a newer version is refused. Every imported row is checked before anything is written, and one bad row rejects the whole file. The import asks before replacing, writes all four tables in one transaction, then reloads the page. Unit tests in `src/storage/backup.test.ts`; the round trip and the refused files in `tests/e2e/backup.spec.ts`. There is no manual check.

---

## Open questions
- Should scale drills require a set fingering? (MIDI can't see fingers, so the app can only suggest one.)
- Order of keys for new items: circle of fifths, or the keys the grooves use first? (Recommended: groove keys first, for immediate payoff in jam mode.)
- Should strict inversion mode be on by default once the root positions are stable?

## Done when
The user does a daily 5-minute session that serves due chords and scales interleaved, grades speed and accuracy, fades hints over days, and shows visible progress. Asked "E minor?", they play it instantly.
