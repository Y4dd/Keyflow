# Phase 4: Solo Coaching and Ear Training

**Status:** see `PLAN.md`. **Depends on:** Phase 1 (jam, take analysis) and Phase 2 (item engine). **Read first:** `CLAUDE.md`, [`../learning-design.md`](../learning-design.md), [`../architecture.md`](../architecture.md).

## Goal

Grow from "notes that fit" to **soloing that sounds like music**, and build the ear needed to **play by ear over songs**, which is the user's core inspiration.

## In scope
Structured soloing exercises with measurable criteria, extended take analysis, and four ear-training games plugged into the item engine.

## Out of scope
Song import (Phase 5) and licks (Phase 6).

---

## Tasks

### P4-T1: Extended take analysis
Pure functions over a recorded take plus the groove's harmony timeline:
- chord-tone landing rate on strong beats and on chord changes
- phrase detection (notes separated by rests ≥ a threshold), phrase lengths and the space between phrases
- rhythmic motif repetition (similar onset patterns)
- note density per bar, range and contour
- use of glide, bends and the blue note
- **Automated:** unit tests with fixture takes.

### P4-T2: Soloing exercises
Each exercise is a short, opt-in challenge over a groove with **one** measurable goal. Starting set, open to change:

| Exercise | Goal measured |
|---|---|
| Three-note solo | Use only 3 chosen notes for 8 bars, and make it musical with rhythm |
| Call and response | Play 2 bars, rest 2 bars, repeated |
| Rhythm motif | Repeat one rhythm with different notes |
| Target the 3rd | Land on the chord's 3rd on beat 1 of each change |
| Slide into it | Use legato glide into at least one target note per phrase |
| Space | At most N notes per bar |
| Blue note | Use the ♭5 as a passing tone, not a landing note |

- Results are encouraging: show met or not-yet plus one tip. Exercises become items so they get spaced too.

### P4-T3: Call and response (ear)
- The app plays a short phrase (2–5 notes) in the groove's key, and you play it back.
- Scored on pitch and, optionally, rhythm. Phrase length adapts, aiming for about 80–85% success.

### P4-T4: Scale-degree hearing
- A short cadence sets the key, then one note plays. Answer by playing it.
- Items are `ear:degree:<n>`. This is the core skill for finding melody notes by ear.

### P4-T5: Find the key
- A loop plays (from the groove engine, in a random key). Hunt for the home note (tonic) by playing.
- Show the attempts and time taken. This directly prepares for jamming over real songs.

### P4-T6: Chord quality
- A chord plays. Identify it by playing any chord of the same quality: major, minor, dom7, m7, maj7.

---

## Open questions
- Should the call-and-response phrases use the lead synth sound, or a neutral piano tone for clarity?
- Should ear items share the daily core session with drills, or have their own slot?

## Done when
The user can echo short melodies, find the key of a loop in under about 30 seconds, and complete the soloing exercises. Their jam takes show more space, motifs and chord-tone landings over time.
