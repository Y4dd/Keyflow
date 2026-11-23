# Keyflow

A browser app that teaches an adult to play **synth solos and chords over grooves** (electro-funk and soul) using a MIDI keyboard. It uses spaced, interleaved drills, a jam mode with live chord-tone highlighting, comping, ear training and a built-in synth. Local-first, open source (MIT), with no backend.

## Before any work
1. Read [`PLAN.md`](PLAN.md): phase status, the **decisions log** and open questions.
2. Read the current phase file in [`docs/phases/`](docs/phases/), and take **one task ID** (e.g. `P0-T3`) at a time.
3. Read [`docs/architecture.md`](docs/architecture.md) before writing code and [`docs/learning-design.md`](docs/learning-design.md) before touching drills, grading or feedback.
4. **Phases are open to discussion.** If a task should change, propose it to the user first. Once agreed, update the phase file **and** add a dated line to the decisions log in `PLAN.md`. Don't silently diverge from the plan.
5. When a task is finished, mark its heading in the phase file (`[done YYYY-MM-DD]`) and update the phase status in `PLAN.md`.

## Commands (Node 26)
```sh
npm run dev          # Vite dev server
npm run build        # tsc -b + vite build
npm run typecheck    # tsc -b
npm run lint         # oxlint (not ESLint)
npm run format       # Prettier write   (format:check in CI)
npm test             # Vitest unit tests: src/**/*.test.ts(x)
npm run test:e2e     # Playwright, Chromium + Firefox, tests/e2e/
```
Run typecheck, lint, format:check and test before calling a task done. CI (`.github/workflows/ci.yml`) runs all of them, then deploys `main` to GitHub Pages (`VITE_BASE` is set to the repo sub-path there).

## Stack (rationale in `docs/architecture.md`)
TypeScript 7 (strict) · Vite 8 · React 19 · Zustand · Tone.js over Web Audio · tonal · ts-fsrs · Dexie (IndexedDB) · Canvas 2D · Vitest · Playwright · oxlint · Prettier · GitHub Pages. Versions are exact-pinned. Check licenses before adding a dependency.

## Hard rules
- **Audio hot path:** MIDI → audio engine directly, never through React state. Trigger live notes by passing `Tone.immediate()` explicitly as the time. **Not** `Tone.now()` and not an omitted time argument, which both add about 0.1 s of look-ahead. Canvas reads state each frame; no per-note React re-renders.
- **Pitches are MIDI numbers** internally, and pitch class is `midi % 12`. Note names only at the display boundary, spelled by key. Progressions are Roman numerals relative to a key.
- **Pure logic is pure and tested:** `music/`, `analysis/`, `practice/` grading and scheduling, and MIDI parsing have no DOM, no Tone.js and no React.
- **The AI can't press keys.** Every graded feature must work through the simulated MIDI source (`input/sim/`, `window.__keyflow.inject()` in dev). Split acceptance checks into *automated* and *manual (user on the real keyboard)*.
- **Original content only:** no copyrighted recordings, songs or transcriptions ship with the app, and no presets or features are named after real artists. User song files stay local and are never uploaded.
- **Licenses:** MIT project. Dependencies must have MIT, Apache-2.0, BSD or ISC licenses. GPL, LGPL and AGPL require a logged decision in `PLAN.md`.
- **No sheet music** or notation anywhere. Prompts use note names, chord symbols and Roman numerals.
- **Feedback tone:** in jam mode, out-of-scale notes are dimmed, never red. Give one suggestion, not a report card.
- **Never break user data:** Dexie schema changes go through versioned migrations.
- Don't state unverified browser, library or hardware facts as true in code comments or docs. Verify them (Phase 0 records the findings).

## Hardware and environment (the user's setup)
- **Yamaha YPT-380:** 61 keys, velocity-sensitive, USB-to-host MIDI, **no pitch bend wheel**. Expected note range is MIDI 36–96 (verify in P0-T2). Its own sound should be silenced with **Local Control off** (confirm the setting exists in P0-T2; otherwise turn its volume to zero) so it doesn't double the app's sound.
- **One sustain pedal** (CC64), the only pedal, so its function is a mode setting: Sustain / Bend / Glide-hold. Offer "invert pedal".
- Bend substitutes: legato glide, pedal-bend, laptop bend (key or wheel), and scale-aware bend.
- Windows 11 gaming laptop. **Firefox and Chrome are both supported.** Firefox gates Web MIDI behind an auto-generated site-permission add-on prompt, and the onboarding must explain it. On Windows, another music app may hold the MIDI device.
- Note-on with velocity 0 = note-off.

## The learner
Knows fragmented basic theory: C major yes, E minor no. Wants to solo and comp by ear over funk and soul with synths. Priorities in order: **solo → comping → chords → leads → songs**. Practices 5–60 minutes a day. More detail is in `PLAN.md`.
