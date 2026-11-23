# Phase 3: Comping Mode

**Status:** see `PLAN.md`. **Depends on:** Phase 1 (grooves, harmony timeline) and Phase 2 (item engine, chord recognition, 7th chords). **Read first:** `CLAUDE.md`, [`../learning-design.md`](../learning-design.md), [`../architecture.md`](../architecture.md).

## Goal

Play chord changes **in time, with feel**, over a groove. That means soul voicings that move smoothly and funk stabs that lock to the beat. Comping is the user's second priority.

## In scope
Chord-along view, comping scoring (chord, timing, voice leading, rhythm, dynamics), soul voicing items, a progression library, rhythm patterns, tempo ramping, and a left-hand bass plus right-hand chords mode.

## Out of scope
Solo coaching (Phase 4) and songs (Phase 5).

---

## Tasks

### P3-T1: Chord-along view
- A chord lane scrolls in time with the groove: the current chord, the next one, and beats to go before the change.
- Optional ghost "suggested voicing" shown on the canvas keyboard, which fades with training-wheel level.

### P3-T2: Comping scoring
For each chord span, score:
- **Chord correctness:** the required tones are present. For 7th chords the **3rd and 7th are required** and the root is optional, because soul voicings are often rootless.
- **Timing:** the onset relative to the expected hit, after the calibration offset. Show "early" or "late", not just a number.
- **Voice leading:** total semitone movement between consecutive voicings. Lower is smoother; highlight big leaps.
- **Rhythm match** (when a rhythm pattern is set): the hits match the pattern's onsets within a tolerance.
- **Dynamics:** accents and ghost notes by velocity.
- **Automated:** scoring unit tests with fixture takes (good, late, wrong chord, rootless voicing, big leaps).

### P3-T3: Voicing items
Add to the Phase 2 curriculum:
- guide tones (3rd plus 7th) for m7, dom7 and maj7
- 9th voicings: m9, maj9, dom9; sus voicings
- inversions chosen for smooth voice leading through progressions

### P3-T4: Progression library
Stored as Roman numerals and transposable. Starting set:
- i7 – IV7 (Dorian funk vamp)
- ii7 – V7 – Imaj7
- Imaj7 – vi7 – ii7 – V7
- IVmaj7 – iii7 – ii7 – Imaj7 (neo-soul descent)
- i7 – iv7
- Imaj7 – IVmaj7

Each progression in each key becomes a `prog:` item.

### P3-T5: Rhythm patterns
- Funk: 16th-note stabs, anticipations (pushes ahead of the beat), and ghost-note patterns.
- Soul: sustained chords with pushes.
- Each pattern is data. Show it as a simple rhythm lane, not notation.

### P3-T6: Tempo ramp
- Start at 60–70% of the groove tempo. After a clean pass (thresholds in config), speed up by 5% until reaching full tempo.

### P3-T7: Two-hand mode
- Left zone plays the bass root (or a bassline pattern), right zone plays the voicings. Both are scored.

---

## Open questions
- Rhythm-match tolerance: how strict for 16th-note funk? (Start at about ±40 ms after calibration, then tune.)
- Show a suggested voicing by default, or only after a miss?

## Done when
The user can comp a ii–V–I and a Dorian funk vamp in several keys over a groove, using smooth 7th and 9th voicings and a funk rhythm. The app shows exactly what to tighten: the chord, the timing, the leaps or the rhythm.
