# Phase 1: Jam Mode

**Status:** see `PLAN.md`. **Depends on:** Phase 0. **Read first:** `CLAUDE.md`, [`../architecture.md`](../architecture.md), [`../learning-design.md`](../learning-design.md) (feedback tone).

## Goal

Press play on a groove and solo over it with the notes that fit lit up. This is the user's top priority (soloing) and the app's most fun, motivating experience. Record and replay your takes.

## Key design idea

Grooves are **pattern data, not audio files**. The app generates drums, bass and chords itself, so it always knows the current chord (`HarmonyAt`) on every beat. That makes live chord-tone highlighting, instant key and tempo changes, and later grading (Phases 3 and 4) possible.

## In scope
Groove data format and player, four original grooves, transport controls, harmony timeline, scale and chord-tone highlighting with adjustable "training wheels", scale-aware bend, mixer, record, replay, MIDI export, basic take stats.

## Out of scope
Coaching exercises and grading of solos (Phase 4), comping scoring (Phase 3), imported songs (Phase 5).

---

## Tasks

### P1-T0: App redesign and design system [done 2026-11-26]
Added 2026-11-25 (the user's request): the app is redesigned before the rest of Phase 1, so jam mode's new UI builds on the new look instead of being redone later.
- **First, a defined design theme and a mood board**, so the app stays consistent: the mood (what playing in Keyflow should feel like), colours, type, spacing, shapes, motion and a mood board of reference images and swatches (original or properly licensed, kept in the repo, e.g. `docs/design/`). The user approves both before any screen changes.
- Then use the `impeccable` skill to turn them into a design system (written down where the skill puts it, e.g. `DESIGN.md`) and redesign every current screen: MIDI onboarding and device panel, Sound panel (split, zones, presets, knobs, pedal and bends), Play panel with the canvas keyboard, Timing panel. Goal: friendlier for a learner (a first visit makes clear what to do next) and prettier. The dev inspector may stay plain.
- **Design direction is the user's taste call:** when the skill needs a direction or a comp approved, ask the user in chat.
- **No behaviour changes.** Every unit and e2e test still passes in both browsers; selectors may change with labels, assertions don't.
- The hard rules hold: no notation, canvas draws only after a change, nothing new on the audio or input path, out-of-scale notes dimmed never red (for Phase 1 to follow).
- Fonts, icons and images are self-hosted (no third-party requests at runtime, the app stays local-first), with each license in `src/assets/LICENSES.md`; anything not MIT, Apache-2.0, BSD or ISC (e.g. SIL OFL fonts) gets a decisions-log line.
- **Manual:** the look on the deployed page (taste) and that playing still feels instant with the canvas keyboard lighting the right keys (must-pass).

_Manual check results (2026-11-26, deployed page, Chrome, YPT-380): steps 1 and 2 pass; the look is kept. Feedback: the highlighting dots (P1-T4) are unpleasant to look at and can confuse, and the user wants an option to hide the computer-key letters on the keys; both go to P1-T4b._

### P1-T1: Groove data format [done 2026-11-25]
- TypeScript types plus a JSON-serializable format with:
  - tempo, swing amount, key and mode, bar count
  - progression as Roman numerals with durations (e.g. `[{ rn: "i7", beats: 8 }, { rn: "IV7", beats: 8 }]`)
  - tracks: drums (steps per instrument with velocity), bass (scale degree plus rhythm), chords (voicing template plus rhythm)
  - a default solo scale and the allowed alternatives
- Pure functions: `harmonyAt(groove, transportTicks) → HarmonyAt`, transpose and tempo scaling.
- **Automated:** unit tests for `harmonyAt` across bar boundaries, transposition and swing math.

### P1-T2: Groove player [done 2026-11-26]
- Tone Transport scheduling of drums (synthesized kit or small CC0 samples; record each sample's license in `src/assets/LICENSES.md`), bass (reuse the Wobble Bass or a funk bass preset) and chords (EP Keys).
- The Wobble Bass LFO now syncs to the transport (e.g. 8th or 16th notes, selectable).
- Controls: play/stop, loop, key (12 keys), tempo (±30%), count-in.
- **Automated:** the scheduler produces the expected event list for one bar (test it as data, without audio).
- **Manual:** grooves stay tight with no drift over 5 minutes.

_Manual check results (2026-11-26, deployed page, Chrome and Firefox, YPT-380): steps 1 to 4 pass. Taste steps 5 and 6: defaults kept (wobble sync on 8ths, drum kit and balance as built)._

### P1-T3: Four original grooves [built 2026-11-26, manual check pending]
Write original patterns. **Don't imitate a specific song.** Suggested starting points, open to change:

| Groove | Feel | Tempo | Progression idea | Default solo scale |
|---|---|---|---|---|
| Electro-funk vamp | 16th-note funk, syncopated synth bass | ~108 | i7 – IV7 (Dorian vamp) | Minor pentatonic → Dorian |
| Soul groove | Laid-back backbeat | ~84 | Imaj7 – vi7 – ii7 – V7 | Major pentatonic |
| Slow jam | Half-time, lush | ~70 | IVmaj7 – iii7 – ii7 – Imaj7 | Major pentatonic / major |
| Boogie | Driving four-on-the-floor, octave bass | ~116 | i7 – iv7 | Minor pentatonic / blues |

- **Manual:** the user rates each one as fun to play over, and any that aren't get iterated.
- Built: the four above as written (keys E♭ major, D♭ major and E minor for the new three), plus a Groove menu in the Groove card to pick one (its own key and tempo; restarts if playing). **Automated:** every shipped groove fills its bars, loops evenly, never overlaps bass notes, keeps the bass in the key or on the chord, and stays in a playable register in all 12 keys (`library.test.ts`); e2e plays each from the menu.

_Manual check (2026-11-26, Chrome, YPT-380): not rated yet. The grooves' bass (the Wobble Bass) sounds harsh and distorted, which makes them unpleasant to play over; the EP Keys chords are great. Re-checked after P1-T3b gives the grooves a better bass._

### P1-T3b: A bass that's good to play over [built 2026-11-26, manual check pending]
Added 2026-11-26 (P1-T3 manual check): the grooves play their bass on the Wobble Bass, whose saws run through distortion by design, and the user finds it harsh and distorted, both in the grooves and played with the left hand. The EP Keys chords are great and stay; the lead stays.
- Build 3 or 4 original **clean bass candidates** (e.g. a round filtered synth bass, a plucky finger-style bass, a sub-heavy smooth bass), each a preset with original, non-artist names, using the existing voice code where it fits.
- **The user auditions them** on the deployed page, in the grooves and with the left hand (a picker, which can stay as the preset choice), and picks one. Iterate if none is liked. The pick becomes the grooves' bass and the default left sound; the losing candidates are removed.
- The Wobble Bass stays selectable, made less harsh (at least a lower Drive default); how much is the user's call in the audition.
- **Automated:** preset tests as for the other presets; an offline render of each groove with the new bass stays in the master's linear range (no safety-clip distortion).
- **Manual:** the audition (taste), then the waiting P1-T3 check is re-run with the new bass.
- **Added 2026-11-26 (the user's request in the audition):** a warm electric piano in the spirit of the mellow, tremolo-washed keys the user loves, built as an original sound and not named after the instrument, artist or song: **Warm Tines** (EP Keys' FM voice, a gentle low-pass, a tremolo knob). The user rates it on the page; whether the grooves' chords use it instead of EP Keys is the user's call.

_Audition (2026-11-26): four candidates shipped (Round Bass, Finger Pluck, Velvet Sub, Rubber Bass). The user picked **Round Bass** "for now": it is the grooves' bass and the default left sound, and the other three are removed. Wobble Bass Drive default lowered from 0.4 to 0.15 (the user didn't name a value). **Automated:** preset tests, worst-case and typical renders for Round Bass and Warm Tines below the safety clip, and an offline render of all four grooves with Round Bass peaking under 0.9 (0.73 to 0.78 measured), and a Warm Tines render with the Tremolo knob up swings its level far more than with it off. **Manual:** rating Warm Tines (taste)._

### P1-T4: Highlighting and "training wheels" [done 2026-11-26]
- The canvas keyboard shows three tiers: **chord tones** (strong), **scale tones** (soft) and **other notes** (dimmed, **never red**).
- The upcoming chord change is previewed half a beat early.
- Training-wheel levels: 3 = all tiers plus note names; 2 = all tiers; 1 = chord tones only; 0 = off.
- Solo-scale picker per groove: minor pentatonic, blues, Dorian, major pentatonic, major, Mixolydian.
- **Automated:** the tier for each key, given a `HarmonyAt` (pure function).
- Built: `tierOf` and key-aware `noteNames` (`src/music/`), `previewTick` (half a beat ahead, first chord in the count-in and when stopped), a Scale menu offering the groove's own scales (reset on a groove change) and Training wheels chips (Names, Dots, Chord tones, Off; Names by default) in the Groove card, and the dots and dimming the theme planned. Highlighting shows whenever wheels are on, the selected groove's first chord when stopped. **Automated:** unit tests for tiers, spelling (all keys, modes and scales), the preview position and the dot geometry; e2e checks each level, the scale menu and that the next chord is drawn half a beat early in Chromium and Firefox. **Manual:** lag while the dots move, readability, preview timing, default level.

_Manual check results (2026-11-26, deployed page, Chrome, YPT-380): step 1 passes and the user likes the training wheels. Taste step 2: the dots are unpleasant to look at and can confuse, so P1-T4b tries several visuals until the user likes one. Steps 3 and 4 unanswered: defaults kept (half a beat early, Names)._

### P1-T4b: Highlighting visuals the user likes, and hiding the key letters
Added 2026-11-26 (P1-T0 and P1-T4 manual checks): the user likes the training wheels, but the dots are unpleasant to look at and can confuse.
- With the `impeccable` skill, design **3 or 4 clearly different highlighting visuals** for the three tiers (chord tones, scale tones, other notes dimmed, never red) and the note names, within the Crate Dig theme. Ship them switchable on the deployed page so the user can compare them while playing; iterate until the user likes one. The chosen one becomes the only one, and the others are removed.
- Add an option to **hide the computer-key letters** on the canvas keyboard, saved with the other settings.
- Everything P1-T4 tests (tiers, preview timing, levels) keeps passing; lit held keys stay distinct from highlighting.
- **Manual:** the comparison and the pick (taste); playing stays instant with the chosen visual (must-pass).

### P1-T5: Scale-aware bend
- New bend amount option: **"to next scale tone"**. The pedal or laptop bend targets the next note up in the current solo scale (1 or 2 semitones, depending on the note).
- **Automated:** bend target per note, per scale.
- **Manual:** pedal bends in jam mode sound musical.

### P1-T6: Mixer
- Levels for drums, bass, chords and your synth. Mute buttons. A **"you play bass"** toggle mutes the groove bass when your left zone is the bass.

### P1-T7: Record, replay, export
- Record your input events with transport positions, saved to the Dexie `takes` table.
- Replay together with the groove. The piano-roll view shows your notes over the chord timeline.
- Export a take as `.mid`.
- **Automated:** record → replay round trip through the simulated source gives identical events.

### P1-T8: Basic take stats (gentle)
- After a take: notes played, range used, % of notes in the scale, % of notes landing on chord tones on strong beats, longest rest.
- Show **one** suggestion picked from simple rules, e.g. "Try leaving a full bar of space between phrases" or "You haven't used the blue note yet". No score.

---

## Open questions
- Synthesized drums only, or allow CC0 samples for punch?
- Should grooves have A/B sections (vamp plus a turnaround) from the start?
- Should note names on the keys use flats or sharps by key automatically (`tonal` spelling), or follow a user preference?

## Done when
The user picks a groove and key, presses play and solos with the funk lead in their right hand (optionally bass in the left), sees which notes fit, bends with the pedal, and can replay and export the take.
