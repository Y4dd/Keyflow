# Phase 0: Foundation

**Status:** see `PLAN.md`. **Depends on:** nothing. **Read first:** `CLAUDE.md`, [`../architecture.md`](../architecture.md).

## Goal

Plug in the Yamaha YPT-380 and play a synth that sounds good and feels responsive, in both Firefox and Chrome. Includes a split keyboard, pitch-bend substitutes and a measured latency calibration. Everything later builds on this.

## In scope
- Project scaffold, tooling and deploy
- Hardware and browser check (first, before features)
- Unified input bus: MIDI, computer keyboard, on-screen piano, simulated source
- Audio engine with three presets, split keyboard, pedal modes, glide and laptop bend
- Latency calibration
- Canvas keyboard display
- Settings persistence

## Out of scope
Grooves and backing (Phase 1), drills (Phase 2), the sound-design UI (Phase 6; Phase 0 presets are fixed data plus a few knobs).

## Testing note
The implementer (AI) can't play the keyboard. Every task lists **Automated** checks (Vitest or Playwright through the simulated source) and **Manual** checks the user runs on the real keyboard. A task is done only when both pass.

---

## Tasks

### P0-T1: Scaffold [done 2026-11-23]
_Repo: https://github.com/Y4dd/Keyflow (public). CI is green: checks, then deploy. Live at https://y4dd.github.io/Keyflow/ (page, CSS and favicon load under the sub-path). ESLint was replaced by oxlint (see the decisions log)._

Vite + React + TypeScript (strict), oxlint, Prettier, Vitest, Playwright, an MIT `LICENSE`, a GitHub Actions workflow that builds and deploys to GitHub Pages, and a README stub.
- Before installing, check the current stable versions and licenses of the stack libraries in `architecture.md`. Pin the versions.
- Add the real commands (`dev`, `build`, `test`, `test:e2e`, `lint`) to `CLAUDE.md`.
- **Automated:** `build`, `lint` and `test` pass in CI.
- **Manual:** the deployed page loads.
- Initialize git and create the GitHub repo first (see the open questions in `PLAN.md`).

### P0-T2: Hardware and browser check (spike) [done 2026-11-23]
_The spike page (`spike/hardware.html` + `src/spike/`, deployed as a second Vite entry) was deleted in P0-T3. To run it again, restore it from commit c25542f; it has a "Copy report" button that produces JSON for the Findings section._

A throwaway dev page that requests MIDI access, lists inputs and logs raw messages, and plays a basic sine on note-on using `Tone.immediate()`.
- **Manual (the user, in Firefox and in Chrome, one browser at a time):**
  - **Close the other browser and any music apps first.** On Windows, a MIDI device may be usable by only one app at a time, so a second open browser can make the device look broken.
  - Does Windows need a Yamaha USB-MIDI driver, or does the keyboard appear as a standard class-compliant device?
  - The keyboard can also act as a USB **audio** device. Check that plugging it in didn't switch Windows' default audio output to the keyboard; the app should play through the laptop's output and headphones.
  - Confirm the keyboard has a **Local Control** setting (in its function menu). If it doesn't, turn the keyboard's own volume to zero.
  - The device shows up.
  - In Firefox, the add-on prompt appears. Record exactly when: is the device needed before launch?
  - Notes, velocities and the sustain pedal (CC64 values and polarity) arrive.
  - Note the lowest and highest MIDI note numbers (expected 36–96; verify).
  - Rate whether the sine feels playable: "feels instant / slight lag / unplayable".
  - Read out `outputLatency`, `baseLatency` and `getOutputTimestamp()` support.
- **Output:** a "Findings" section appended to this file with the results. If latency is unplayable in one browser, stop and discuss before continuing.

### P0-T3: Input bus and MIDI layer [done 2026-11-23]
_Built and pushed as 26d419e. Manual checks 1–4 passed on the deployed page in Firefox and Chrome (2026-11-23): connects silently, notes and chords show and clear, the pedal reads down for the whole hold, and unplug/replug recovers without a reload. Code: `src/input/types.ts` and `bus.ts` (synchronous bus); `src/input/midi/parse.ts` (pure parser, one per input), `onboarding.ts` (pure state machine), `connection.ts` (access, hot-plug, device selection, "no input yet" hint; tested with a fake `MIDIAccess`) and `browser.ts`; `src/state/midi.ts` (Zustand store, changes only on status and device changes); `src/ui/MidiPanel.tsx` and `LiveInput.tsx` (held notes and pedal, written to the DOM once per frame). Choices: listen to all inputs by default (a selector appears with more than one); "invert pedal" inverts the any-channel aggregate, not each channel, since inverted per channel the YPT-380's constant ch 3 zero would read as held forever; on unplug or deselect, held notes and the pedal are released; a `checking` flag (not a seventh state) covers the moment before the permission query answers; the "no input yet" hint counts any byte, clock included, as proof the port delivers, and shows after 4 s of silence or when `open()` fails._

**Manual checks (deployed page, Firefox and Chrome, one at a time):**
1. The page connects (no prompt is expected: the origin was granted during P0-T2) and shows `Digital Keyboard-1`.
2. Play single notes and chords: "Held notes" shows them and clears on release.
3. Hold the pedal for a few seconds: it reads **down the whole time**, then **up** on release.
4. Hold a key and unplug the USB cable: the panel shows "No keyboard found". Plug it back in: "Keyboard connected", and notes show again, without a reload.
5. Optional: with the page open in Chrome, open it in Firefox too. Note which panel the second browser shows ("Keyboard connected" with notes, the "Nothing has arrived" hint, or "No keyboard found").

**Not yet verified (copy avoids claiming them):** what Firefox does with no device connected on the first request; what cancelling Firefox's add-on prompt returns; how to undo a refusal in each browser. Check them when convenient by clearing the site's permission.

- `input/midi/`: access, device selection, hot-plug and parsing into `InputEvent` (see the MIDI parsing facts in `architecture.md`).
- Apply the P0-T2 findings (see Findings below): drop 0xF8 and 0xFE before any other work; accept notes on all channels; track CC64 per channel, with the pedal down if any channel is ≥ 64 (the YPT-380 sends ch 3 = 0 on every press); ignore bank select, program change and other unused CCs; don't clamp notes to 36–96.
- Delete the spike: `spike/`, `src/spike/` and the `hardware` input in `vite.config.ts`.
- Firefox onboarding state machine: `unsupported` → `needsPermission` → `waitingForAddon` → `granted` / `denied` / `noDevices`, each with clear UI copy built from the P0-T2 findings.
- Windows "device busy" hint when no input arrives.
- **Automated:** unit tests for parsing (note-on with velocity 0 = note-off, CC64 thresholds, inverted pedal, ignored message types) and for state transitions.
- **Manual:** unplug and replug while the app runs, and it recovers.

### P0-T4: Simulated input and fallbacks [done 2026-11-23]
_Built and pushed as e105c20. Manual check 1 done: `tests/fixtures/ypt380-chrome-song.json` (a 40 s song in Chrome; see Findings); checks 2 and 3 not yet reported. Code: `src/input/sim/` (`script.ts` chord and sequence builders, `player.ts` timed playback with stop/release, `fixture.ts` raw-MIDI fixture format, recorder, replay through the real parser and analysis); `src/input/computer/keyboard.ts` and `src/input/onscreen/pointer.ts` (pure controllers, unit-tested); `src/dev/` (`window.__keyflow` and the event inspector); `src/ui/PlayPanel.tsx` and `OnscreenPiano.tsx`. Choices: fixtures store **raw MIDI messages** (clock and active sensing only counted), not parsed events, so they keep channels and exercise the parser; dev tools exist in the dev server and in builds made with `KEYFLOW_DEV_TOOLS=true` (Playwright builds into `dist-e2e/`), and CI fails if `__keyflow` appears in the production `dist/`; the computer keyboard uses physical key codes (home row = white keys from C4, row above = black keys), ref-counts a pitch held by two keys after an octave shift, and releases everything on window blur; the on-screen piano (C3 to C6, DOM, minimal until the P0-T9 canvas) lights held notes from every source and supports sliding and multi-touch (touch is tested only with Chromium's emulation, not on a real touch screen); held notes and the pedal now show in a Play panel that works without MIDI. A synthetic fixture (`tests/fixtures/synthetic-chord-and-pedal.json`, labeled as such) keeps the fixture tests running until a real one is committed._

**Manual checks:**
1. **Record a fixture (Chrome, dev server).** Run `npm run dev` and open http://localhost:5173 in Chrome. It's a different origin from the deployed page, so Chrome may ask for MIDI access: Connect and Allow. First do a five-second trial in "Dev inspector" at the bottom (**Record MIDI**, play a note, **Stop and save**) and check that a file downloads. Then type what you'll play, press **Record MIDI**, and play for about a minute: single notes across the whole keyboard, a few held chords, a fast run, the pedal held while playing, and one voice change on the keyboard. Press **Stop and save**; the file downloads. Move it to `tests/fixtures/` (e.g. `ypt380-chrome-basic.json`) and note the numbers the inspector shows (note-ons per channel, same pitch on two channels). Firefox on localhost isn't verified, so use Chrome for this.
2. After this is pushed, on the deployed page, in both browsers: the computer keys play (held notes show), Z and X shift the octave, and the `'` key plays F5 without opening Firefox's quick-find bar.
3. Click and drag across the on-screen keys: notes follow the pointer and nothing stays lit after release.

- `input/sim/`: scripted sequences, fixture replay, `window.__keyflow.inject()` in dev builds only.
- Dev event inspector that records real input to a JSON fixture.
- Computer keyboard mapping: two rows as a piano, Z/X to shift octave, velocity fixed at 0.8.
- On-screen piano: clickable, with pointer and touch.
- **Automated:** a Playwright test injects a chord and sees the keys light up.
- **Manual:** record a fixture from the YPT-380 and commit it under `tests/fixtures/`.

### P0-T5: Audio engine and presets [done 2026-11-23]
_Built and pushed as 9823a0f (CI fix bd32a39: a silent PulseAudio device so Firefox's live audio tests can run on the Linux runner). Manual checks 1–6 passed on the deployed page: the user reported "looks good" and that it feels instant. Code: `src/audio/voices.ts` (pure poly allocator, mono last-note stack, legato-glide decision), `curves.ts` (pitch, velocity and knob curves, the master's safety clip), `latency.ts` (the outputLatency accessor), `presets/` (the three presets as JSON-serializable data); `src/audio/tone/` (`voices.ts` Tone graphs per preset kind, `instrument.ts`, `master.ts`, `engine.ts`, loaded on the first click or key press); `src/state/audio.ts` (controller and store); `src/ui/SoundPanel.tsx` (start state, presets, knobs, latency readout); `src/dev/render.ts` and `signal.ts` (offline renders measured in e2e). Choices are in the decisions log (2026-11-23, P0-T5 entries): the private-field latency route, lazy engine loading (starting retries `resume()` on every gesture until the context runs), the safety clip (agreed), and Keyflow's own voice logic. Knobs: Funk Lead cutoff and glide time; Wobble Bass cutoff, wobble rate and drive; EP Keys brightness. The default preset is Funk Lead. Automated: unit tests for voice allocation, the mono stack and legato glide, curves, presets, the latency accessor and the controller; e2e in both browsers for starting on a click, the latency readout, notes reaching the engine, and offline renders per preset (worst case below full scale, silence after release, typical playing clear of the safety clip, velocity audible, EP brighter when harder)._

**Manual checks (dev server first, then the deployed page after the push; Firefox and Chrome; Local Control off):**
1. With sound off, play a key on the YPT-380: the Sound panel says the keyboard is playing and asks for a click. Click anywhere: "Sound is on" with an output latency.
2. **Funk Lead:** play single notes, then overlapping (legato) notes. The pitch slides only between overlapping notes; detached notes start on their own pitch. Move Cutoff and Glide time while holding a note.
3. **Wobble Bass:** low notes wobble, the sub stays solid underneath, and Drive adds grit. Try Wobble rate.
4. **EP Keys:** chords sustain and decay naturally; soft notes are quieter and darker, hard notes louder and brighter. Try Brightness.
5. In all three: no clicks when notes start or stop, no distortion on big chords or hard notes, and no stuck notes. Switch presets while holding notes: nothing sticks.
6. Does it still feel instant? (The limiter stage adds about 6 ms; see Open questions.) Note the output latency the panel shows in each browser (P0-T2 read 40 ms in Chrome and 32 ms in Firefox). **User, 2026-11-23: feels instant.**
- One AudioContext (`latencyHint: "interactive"`), resumed on the first user gesture, with a clear "click to start audio" state.
- Master chain: gain → limiter, so nothing clips.
- **Latency readouts (from P0-T2):** Tone's wrapped context (standardized-audio-context) doesn't expose `outputLatency` or `getOutputTimestamp`, and `Tone.setContext(nativeContext)` fails in Firefox ("param must be an AudioParam"). Pick a supported way to get these values (check Tone and standardized-audio-context options first; the private `_nativeAudioContext` field is a last resort) and log the choice.
- Voice types: **poly** for keys; **mono, last-note priority** for lead and bass.
- Presets, stored as data:
  - **Funk Lead:** saw plus square, low-pass filter with envelope, **legato-only glide**. Glide happens when a new note starts while another is held; otherwise there is no glide. Tone's MonoSynth portamento applies always, so control it per note.
  - **Wobble Bass:** two detuned saws plus a sub sine one octave down. The **sub stays on a separate clean path that bypasses distortion**. Low-pass filter modulated by an LFO (tempo-synced once Phase 1 adds a transport; free-running rate in Phase 0), waveshaper distortion with 4× oversampling, then compression.
  - **EP Keys:** two-operator FM, electric-piano-like, velocity changes the brightness.
- A few exposed knobs per preset (cutoff, glide time, LFO rate, drive).
- **Automated:** unit tests for voice allocation and the legato-glide decision logic.
- **Manual:** each preset sounds good, nothing clicks or clips, and velocity is audible.

### P0-T6: Split keyboard
- Two zones with a movable split point (default: a sensible point such as F3 or G3; verify on the real keyboard). Each zone has its own preset and octave transpose. Default: Wobble Bass on the left, Funk Lead on the right.
- **Automated:** zone routing unit tests.
- **Manual:** left-hand bass plus right-hand lead at the same time, with no stuck notes.

### P0-T7: Pedal modes and bend substitutes
- Pedal mode setting: **Sustain** (normal), **Bend** (pedal down bends the lead up by N semitones over T ms; release returns), **Glide-hold** (pedal down forces glide on).
- Bend amount: 1 or 2 semitones. A later option (Phase 1): bend to the next scale tone.
- Laptop bend: hold a configurable key to bend up while held, or use the mouse wheel or touchpad scroll as a continuous bend that springs back to center.
- "Invert pedal" setting for polarity.
- **Automated:** unit tests that map pedal and bend events to pitch targets per mode.
- **Manual:** bending a held lead note with the pedal sounds smooth and expressive.

### P0-T8: Latency calibration
- Tap test: a click plays for 8–16 beats and the user taps any key on the beat. Store the median offset (ms) as the calibration offset. Show its spread; if it's too noisy, ask to retry.
- Show a latency readout (`outputLatency` where available) and setup tips: wired headphones into the laptop, turn the keyboard's **Local Control off** so its built-in sound doesn't double the app's, close other music apps.
- **Automated:** unit test for offset computation with outlier rejection.
- **Manual:** calibrate in both browsers and record the values in Findings.

### P0-T9: Canvas keyboard and settings
- 61-key canvas keyboard showing held keys, with velocity as intensity, the zones and the split point.
- Settings persisted with Dexie: device, zones, presets and knobs, pedal mode, calibration, audio-started hint.
- **Automated:** settings round-trip test; Playwright smoke test.
- **Manual:** reload, and settings are kept.

---

## Open questions
- Preferred default split point and octave layout after trying it on the real keyboard?
- Laptop bend key: Space? Shift? Decide after trying it.
- Notes sometimes arrive on ch 2 and 3 (P0-T2, cause unknown). If the same pitch ever arrives on two channels at once, the bus sees two note-ons and two note-offs; P0-T3 passes them through unchanged. **Still open:** the P0-T4 song recording had every note on ch 1 (see Findings), so it neither shows the ch 2/3 notes nor rules them out. Record again with the dev inspector if they reappear (its summary counts notes per channel and same-pitch doubles), and decide then whether to ref-count notes across channels.
- ~~**Limiter and safety clip (P0-T5):** the master chain's DynamicsCompressor delays all sound by 6.0 ms (measured in both browsers), and it also raises the level of everything by about 3.4 dB (its makeup gain: Funk Lead's typical peak is 0.31 with it, 0.21 without). Options: **(a)** keep gain → limiter → safety clip as built; **(b)** drop the limiter (0 ms delay), keep the safety clip, lower EP Keys by about 5 dB and raise the master gain to match the current loudness. Without the limiter, a ten-note EP chord at the recording's hardest velocity reaches the clip (0.98 in Firefox, 0.89 in Chromium). The safety clip itself is an addition to the spec and also needs the user's agreement.~~ **Decided 2026-11-23: (a), keep gain → limiter → safety clip as built.** The user found it feels instant.
- ~~Does Firefox latency on this laptop feel close enough to Chrome's?~~ Yes: both feel instant (P0-T2). Firefox delivers MIDI about 25 ms later, so calibrate per browser.

## Done when
You can plug in the YPT-380 in Firefox or Chrome, pass onboarding, calibrate, and play left-hand wobble bass plus right-hand funk lead with pedal bends, all feeling responsive. CI is green and the app is deployed.

## Findings
_(Filled in during P0-T2 and P0-T8.)_

### P0-T2, Firefox run 1 (2026-11-23, Firefox 160, deployed https page)
- **Device:** appears as input and output `Digital Keyboard-1`, with an empty manufacturer and version. The user installed a Yamaha driver long ago, so it's unknown whether class-compliant mode alone works.
- **Windows audio:** plugging in did not switch the default output to the keyboard. **Local Control exists**, and the user turned it off.
- **Firefox permission:** `permissions.query({name:'midi'})` returned `prompt` before and `granted` after. The add-on prompt appeared on the first `requestMIDIAccess()` (resolved after 3.6 s of user interaction, with the keyboard already plugged in). A second request resolved in 0 ms.
- **Notes:** note-off arrives as **note-on with velocity 0** (79 of 79 releases; never 0x80). Range **36–96 (C2–C7)**, confirmed. Velocity 1–127.
- **Pedal:** CC64 sends only 0 and 127 (a switch pedal). Polarity not yet confirmed.
- **Channels:** note-ons arrived on **channels 1, 2 and 3**. Cause unknown (Dual or Split mode?), and run 2 asks. The app should not assume channel 1.
- **Realtime messages:** the keyboard streams **MIDI clock (0xF8)** and **active sensing (0xFE)** constantly: about 16k clock messages in a few minutes. The parser must drop these cheaply.
- **Timing:** `performance.now() - event.timeStamp` at the handler was **28–32 ms (median 30)** every time. Either Firefox delivers MIDI about 30 ms late or its event timestamps use a different basis. Compare with Chrome.
- **Audio:** `baseLatency` 0 ms, `outputLatency` 32 ms (steady), `getOutputTimestamp` supported. Sample rate 44.1 kHz.
- **Bug found:** `Tone.setContext(nativeAudioContext)` throws "param must be an AudioParam" in Firefox, though it works in Chromium, so nothing played and the latency feel wasn't rated. Tone's own wrapped context (standardized-audio-context) works in both, but it **only exposes `baseLatency`, not `outputLatency` or `getOutputTimestamp`**. The spike now reads them through the wrapper's private `_nativeAudioContext` field. **P0-T5 must decide** how the real engine gets these values (the timing model needs them).

### P0-T2, Firefox run 2 (2026-11-23, after the fix)
- **Feel: "instant"** with the sine through Tone's own context. Firefox latency is playable. `outputLatency` was again a steady 32 ms, and `baseLatency` 0.
- **Pedal polarity: unconfirmed.** The user first answered "127" but corrected it during the Chrome run: the live value reads 0 both at rest and held, and 127 only flashes while the pedal moves. See the Chrome run.
- **Permission:** already `granted`, so the second visit had no prompt (the request took 16 ms).
- **Handler delay:** 24–30 ms (median 25), consistent again. Still to compare with Chrome.
- **Channels:** 125 note-ons on ch 1, 6 on ch 2, 3 on ch 3. The user reported Dual and Split as off.
- **The keyboard sends other controllers:** CC0 and CC32 (bank select) plus program change (0xC0), and CC7, CC10, CC72 and CC91. That's the burst a Yamaha keyboard sends when a voice is selected. The parser must ignore anything it doesn't use.
- **Lowest note was 33 (A1)**, below the physical 36. The keyboard's transpose or octave setting probably shifts the transmitted notes. **Don't hard-limit input to 36–96**; the canvas keyboard should cope with notes outside the 61 keys.

### P0-T2, Chrome run (2026-11-23, Chrome 158, deployed https page)
- **Feel: "instant."**
- **Driver:** the port's manufacturer reads **"Microsoft Corporation"**, version 1.0 (Firefox showed it blank). This is Windows' built-in USB MIDI class driver, not a Yamaha driver, so the keyboard works class-compliant.
- **Permission:** a standard Chrome prompt (`prompt` → `granted`, 3.3 s including the user's click).
- **Handler delay: 1–2 ms (median 1.1)**, against Firefox's 24–30 ms. **Firefox adds about 25 ms of MIDI delivery delay** (or offsets its timestamps); Chrome doesn't. For P0-T8, **calibrate per browser**, and consider having onboarding mention that Chrome responds slightly faster.
- **Audio:** `baseLatency` 10 ms, `outputLatency` 40 ms (Firefox: 0 and 32). `getOutputTimestamp` supported. Estimated key-to-ear: Chrome ≈ 1 + 40 ms, Firefox ≈ 25 + 32 ms. Both felt instant.
- **Notes:** range 36–96 with no transpose this time. Note-off is note-on with velocity 0 (31 of 31). All 31 note-ons were on ch 1.
- **Pedal:** **120 CC64 events for 31 notes, arriving on channels 1, 2 and 3**, even though no note came on ch 2 or 3. The keyboard appears to send each pedal change on 3 channels (main, dual and split parts?). The parser should treat CC64 from any channel as the one pedal and drop the duplicates.
- **Pedal polarity: normal, resolved by a raw-log capture.** One press, held about 3.8 s, then released:
  ```
  11.059s  [b0 40 7f] CC64 = 127 ch 1   <- press
  11.059s  [b1 40 7f] CC64 = 127 ch 2
  11.059s  [b2 40 00] CC64 = 0   ch 3   <- ch 3 says "up" even on press
  14.832s  [b0 40 00] CC64 = 0   ch 1   <- release
  14.832s  [b1 40 00] CC64 = 0   ch 2
  14.832s  [b2 40 00] CC64 = 0   ch 3
  ```
  Down = 127 and up = 0 on ch 1 and ch 2. **Ch 3 always sends 0.** The spike's "Pedal right now" field showed the last message in each burst, ch 3's 0, which is why the user saw 127 only flash. The pedal was connected before power-on, so the polarity-at-power-on theory doesn't apply.
- **Parser rule for P0-T3:** keep CC64 state per channel; **the pedal is down if any channel reports ≥ 64**. Reading only the last CC64 message gets it wrong on this keyboard.

### P0-T2 summary
- Both browsers are playable ("instant") with Local Control off, and the keyboard works on Windows' built-in MIDI driver.
- Firefox: the add-on prompt appears on the first `requestMIDIAccess()` with the device connected. Then access is remembered. MIDI arrives about 25 ms later than in Chrome.
- Messages to handle: note-off as velocity-0 note-on; CC64 on ch 1–3 (use any-channel-down); constant 0xF8 clock and 0xFE active sensing (drop first, cheaply); voice-change bursts (bank select, program change, CC7/10/72/91: ignore); occasional notes on ch 2 and 3 (accept all channels); notes outside 36–96 when transposed (don't clamp).
- Audio: `outputLatency` and `getOutputTimestamp` work in both browsers, but **Tone's context wrapper hides them** and a native context can't be handed to Tone in Firefox. P0-T5 must solve this. Calibration (P0-T8) is per browser.

### P0-T4 fixture (2026-11-23, Chrome, dev server)
- `tests/fixtures/ypt380-chrome-song.json`: a 40.5 s song, 448 stored messages, all note-on/note-off (velocity 0) on **ch 1 only**: 224 notes from D2 (38) to G6 (91), velocities 20–79 of 127. No pedal, no voice change, no other CCs. 1,897 clock and 202 active-sensing messages were counted, not stored. It parses and replays through the parser with nothing left held.
- Same pitch on two channels: 0 in this take. No ch 2/3 notes appeared, so the P0-T2 observation is neither confirmed nor explained (see Open questions).
- Pedal and voice-change handling stay covered by the P0-T2 captured messages (parser tests and the synthetic fixture), not by this recording.

### P0-T5 audio measurements (2026-11-23, offline renders in Playwright's Chromium and Firefox)
- **Latency readout:** the private-field route reads finite `outputLatency` and `baseLatency`, and `getOutputTimestamp` is callable, in both browsers (headless; real-device values come from the manual check).
- **Master chain delay: 6.0 ms** (5.986 ms in both browsers): a note's onset through gain → compressor → clip versus straight from the instrument. The compressor is the only stage expected to delay; the gain and the WaveShaper (no oversampling) shouldn't.
- **Master chain with and without the limiter** (peak; "typical" = velocity 79/127, the recording's hardest): EP six-note chord 0.81 / 0.75 (Chromium), 0.78 / 0.88 (Firefox), 1.06–1.24 before the master; EP ten-note chord 0.83 / 0.89 (Chromium), 0.81 / 0.98 (Firefox); Funk Lead phrase 0.31 / 0.21; Wobble Bass phrase 0.22 / 0.15. The limiter raises quiet material (makeup gain) as well as catching peaks.
- **Wobble Bass gate order:** with the saws' amp gate after their compressor, the first 6 ms of a detached note carried extra high-frequency content (hf 0.032, against 0.020 once the gate moved before the compressor, when only the sub sounds in those 6 ms), consistent with the gate opening on the previous note's pitch. Fixed; not yet confirmed by ear.
- **Playwright's browsers don't enforce the user-activation rule** for `resume()` (a synthetic key press started audio), so the lockout fix is covered by a unit test, not e2e.
- **Muting during e2e works:** the user heard nothing from Playwright's Chromium (`--mute-audio`) or Firefox (`media.volume_scale` = 0) while the audio tests ran.
- **The compressor alone is not a ceiling:** a ten-note EP chord at full velocity and brightness peaked at 1.16 through it. With the safety clip: 0.976 (Chromium) and 0.907 (Firefox).
- **Tone's FMSynth runs its carrier and modulator at -10 dB each** (`ModulationSynth.js`). Without compensating, EP Keys was about 14 dB quieter than the other presets, and velocity barely changed its brightness.
- **Peaks playing as hard as the YPT-380 song recording (velocity 79/127):** EP six-note chord 0.80–0.84 (before its level was lowered 2 dB), Funk Lead phrase 0.31, Wobble Bass phrase 0.22: all below the clip's 0.9 knee.
