# Phase 6: Sound Lab and Leads Library

**Status:** see `PLAN.md`. **Depends on:** Phase 0 (audio engine, presets as data), Phase 1 (grooves) and Phase 2 (item engine). **Read first:** `CLAUDE.md`, [`../architecture.md`](../architecture.md), [`../learning-design.md`](../learning-design.md).

## Goal

Two things:
1. **Sound lab:** understand and build the sounds you love, from smooth glide leads to heavy distorted bass with clean sub, through guided, hands-on steps.
2. **Leads library:** learn original licks and riffs as phrases (leads, priority 4), then use them in your own solos.

## In scope
A guided synth tutorial, a full preset editor, saving and sharing presets, an original lick library, a lick-learning flow, saving licks from your own takes, and (if needed) AudioWorklet or WASM synthesis upgrades.

## Out of scope
A full DAW and multitrack recording.

---

## Tasks

### P6-T1: Guided sound lab
Short interactive steps, each with one knob to explore, something to listen for, and a mini-challenge:
1. Oscillator waveforms (sine, saw, square) and what they sound like
2. Filter cutoff and resonance
3. Envelopes (pluck vs. pad)
4. Glide: legato slides
5. LFO wobble synced to tempo, with the challenge "make it wobble in 8ths, then triplets"
6. Distortion plus a clean sub layer: why the sub stays clean
7. Detune and unison width

### P6-T2: Preset editor and sharing
- Edit every preset parameter. Save to Dexie.
- Export and import presets as JSON files (sharing without a backend).
- Preset names must be original. Don't name presets after real artists.

### P6-T3: Lick library (original content only)
- Licks as data: notes, rhythm, glide and bend markings, scale, and the groove they fit. Tagged by technique (slide, blue note, repeated motif, chord-tone target).
- Starting library: about 20 original electro-funk and soul licks written for this project.

### P6-T4: Lick learning flow
Listen → play along slowly with the notes shown → play along at full tempo with hints fading → play from memory → **use it in a jam** (the app suggests where it fits over the groove).
- Each lick in each key becomes a `lick:` item, spaced by FSRS.

### P6-T5: Save a lick from your own take
- Select a phrase in a recorded take's piano roll and save it as a personal lick, which can then be practiced in all keys.

### P6-T6: Synthesis upgrades (only if needed)
- If supersaw or unison width, aliasing or CPU becomes a measured problem, move those voices to an `AudioWorklet`, optionally with Rust→WASM DSP. Benchmark before and after, and log the decision in `PLAN.md`.

---

## Open questions
- Should the lick library allow community contributions via PRs (licks as JSON files), with a contribution guide asking for original content?
- Should the lab include a "match this sound" ear game?

## Done when
The user can build a wobble bass and a funk lead from scratch in the lab, save and share them, and has learned several licks well enough to drop them into their own solos.
