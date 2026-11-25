# Keyflow

A browser app that teaches an adult to play **synth solos and chords over grooves** (electro-funk and soul) using a MIDI keyboard. It uses spaced, interleaved drills, a jam mode with live chord-tone highlighting, comping, ear training and a built-in synth. Local-first, open source (MIT), with no backend.

## Before any work
1. Read [`PLAN.md`](PLAN.md): phase status, the **decisions log** and open questions.
2. Read the current phase file in [`docs/phases/`](docs/phases/), and take **one task ID** (e.g. `P0-T3`) at a time.
3. Read [`docs/architecture.md`](docs/architecture.md) before writing code and [`docs/learning-design.md`](docs/learning-design.md) before touching drills, grading or feedback.
4. **Phases are open to discussion.** If a task should change, propose it to the user first. Once agreed, update the phase file **and** add a dated line to the decisions log in `PLAN.md`. Don't silently diverge from the plan.
5. When a task is finished, mark its heading in the phase file (`[done YYYY-MM-DD]`) and update the phase status in `PLAN.md`. A task whose manual check hasn't happened yet is marked `[built YYYY-MM-DD, manual check pending]`, never `[done]`.

## Working autonomously (standing authorization from the user)
The user wants to be in the loop as little as possible. Work through tasks in order without stopping to ask about routine steps.
- **Commit and push without asking.** When a task (or a self-contained part of one) passes typecheck, lint, format:check, test and test:e2e, commit it to `main` and push. Don't ask "commit?", "push?" or "should I run the tests?". Then confirm CI yourself (one background `gh run watch`, not a polling loop) and fix any failure before moving on. Pushing to `main` deploys to the public Pages site, and the user has accepted that.
- **Manual checks are batched, not blocking.** Hand the user only what needs their hands, ears or the real keyboard. Anything the simulated MIDI source or Playwright can cover is never a manual check. Each manual check is a short, concrete script of what to play and what to listen for. Add it to **Manual checks waiting** in `PLAN.md`, mark the task `[built …, manual check pending]`, and carry on to the next task.
- **Stop for the user only when:**
  1. a task should change what it delivers (rule 4 above, unchanged);
  2. an action is destructive: force-push, rewriting history, deleting user data, or a Dexie change without a migration;
  3. the next task depends on the result of a manual check that is still waiting, or a phase is finished (all its tasks built). Then present the whole queue at once.
- Small implementation choices are yours: decide, add a decisions-log line if it matters later, and mention it in the end-of-task summary rather than asking.

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
- **Yamaha YPT-380:** 61 keys, velocity-sensitive, USB-to-host MIDI, **no pitch bend wheel**. Note range MIDI 36–96, verified (transpose can shift it, so don't clamp). It appears as `Digital Keyboard-1` on Windows' built-in MIDI driver. Silence its own sound with **Local Control off** (the setting exists) so it doesn't double the app's sound.
- **One sustain pedal** (CC64), the only pedal, so its function is a mode setting: Sustain / Bend / Glide-hold. Offer "invert pedal". Polarity is normal (127 = down), but it's sent on ch 1–3 and ch 3 always reads 0: the pedal is down if any channel is down.
- Bend substitutes: legato glide, pedal-bend, laptop bend (key or wheel), and scale-aware bend.
- Windows 11 gaming laptop. **Firefox and Chrome are both supported.** Firefox gates Web MIDI behind an auto-generated site-permission add-on prompt, and the onboarding must explain it. On Windows, another music app may hold the MIDI device.
- Note-on with velocity 0 = note-off.

## The learner
Knows fragmented basic theory: C major yes, E minor no. Wants to solo and comp by ear over funk and soul with synths. Priorities in order: **solo → comping → chords → leads → songs**. Practices 5–60 minutes a day. More detail is in `PLAN.md`.
