# Phase 5: Song Import

**Status:** see `PLAN.md`. **Depends on:** Phase 1 (jam highlighting via `HarmonyAt`) and Phase 4 (ear skills; recommended, not required). **Read first:** `CLAUDE.md`, [`../architecture.md`](../architecture.md).

## Goal

Jam over **real songs the user owns**: load a file, find its key and tempo, loop a section, slow it down, add a chord chart, and solo with the same highlighting as jam mode.

## Legal and privacy rules (hard)
- The app **never ships** songs, recordings or transcriptions.
- User files are processed **locally in the browser and never uploaded**.
- Storing audio in IndexedDB is **opt-in**, with a size warning. By default only metadata, the chord chart and loop points are stored.

## In scope
Local audio loading, waveform view, A/B loop, slowdown that keeps pitch, key and BPM estimation with manual correction, beat grid alignment, chord chart entry, and jam-over-song mode.

## Out of scope
Automatic chord transcription and audio-to-MIDI. Possible future work, which would need a license check before adding any library.

---

## Tasks

### P5-T1: Load and play
- File picker plus drag-and-drop, `decodeAudioData`, waveform rendered to canvas.
- Playback through a media element with `preservesPitch = true` and `playbackRate` for slowdown (built into browsers, so no extra library or license). **Verify the quality and pitch preservation in both Firefox and Chrome**; if it's poor, look for an MIT- or Apache-licensed time-stretch library and log the decision.

### P5-T2: A/B loop
- Drag a loop region on the waveform, snapping to the beat grid once one exists.

### P5-T3: Key estimation
- Chromagram (FFT in a Web Worker) matched against major and minor key profiles. Written in-house: small, pure and testable.
- Show the top 3 candidates. **The user always confirms or corrects.**
- **Automated:** tests on synthetic audio (generated chords in known keys).

### P5-T4: Tempo and beat grid
- Onset detection plus autocorrelation for the BPM estimate, a tap-tempo override, and a downbeat offset nudge.
- **Automated:** tests on synthetic click tracks.

### P5-T5: Chord chart
- Enter chords per bar aligned to the beat grid (typed symbols like `Fm7`, or Roman numerals once the key is set).
- This produces the same `HarmonyAt` timeline used by grooves.

### P5-T6: Jam over song
- Reuse the Phase 1 highlighting, training wheels, record and replay, and take stats over the song.

---

## Open questions
- Which audio formats matter most (MP3, WAV, M4A)? Format support varies by browser, so verify it.
- Is a "chord chart only, no audio" mode (practice a song's changes over a groove) useful? It's a cheap win.

## Done when
The user loads a song they own, confirms its key and tempo, loops a section at 75% speed, enters its chords, and solos over it with highlighting and recording.
