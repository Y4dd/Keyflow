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

### P0-T2: Hardware and browser check (spike) [in progress]
_Spike page: `spike/hardware.html` + `src/spike/`, a second Vite build entry, so it is deployed at https://y4dd.github.io/Keyflow/spike/hardware.html (Firefox may skip the add-on prompt on localhost, so the real prompt has to be observed on the https origin). It has a "Copy report" button that produces JSON for the Findings section. Delete `spike/`, `src/spike/` and the `hardware` input in `vite.config.ts` once P0-T3 lands._

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

### P0-T3: Input bus and MIDI layer
- `input/midi/`: access, device selection, hot-plug and parsing into `InputEvent` (see the MIDI parsing facts in `architecture.md`).
- Firefox onboarding state machine: `unsupported` → `needsPermission` → `waitingForAddon` → `granted` / `denied` / `noDevices`, each with clear UI copy built from the P0-T2 findings.
- Windows "device busy" hint when no input arrives.
- **Automated:** unit tests for parsing (note-on with velocity 0 = note-off, CC64 thresholds, inverted pedal, ignored message types) and for state transitions.
- **Manual:** unplug and replug while the app runs, and it recovers.

### P0-T4: Simulated input and fallbacks
- `input/sim/`: scripted sequences, fixture replay, `window.__keyflow.inject()` in dev builds only.
- Dev event inspector that records real input to a JSON fixture.
- Computer keyboard mapping: two rows as a piano, Z/X to shift octave, velocity fixed at 0.8.
- On-screen piano: clickable, with pointer and touch.
- **Automated:** a Playwright test injects a chord and sees the keys light up.
- **Manual:** record a fixture from the YPT-380 and commit it under `tests/fixtures/`.

### P0-T5: Audio engine and presets
- One AudioContext (`latencyHint: "interactive"`), resumed on the first user gesture, with a clear "click to start audio" state.
- Master chain: gain → limiter, so nothing clips.
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
- Does Firefox latency on this laptop feel close enough to Chrome's? (Answered by P0-T2.)

## Done when
You can plug in the YPT-380 in Firefox or Chrome, pass onboarding, calibrate, and play left-hand wobble bass plus right-hand funk lead with pedal bends, all feeling responsive. CI is green and the app is deployed.

## Findings
_(Filled in during P0-T2 and P0-T8.)_
