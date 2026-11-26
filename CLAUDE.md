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
- **Commit and push without asking.** When a task (or a self-contained part of one) passes typecheck, lint, format:check, test, check:rules and test:e2e, and the review below is done, commit it to `main` and push. Don't ask "commit?", "push?" or "should I run the tests?". Then confirm CI yourself with one background `gh run watch <id> --exit-status`, not a polling loop. Get the id with `gh run list --commit "$(git rev-parse HEAD)" --json databaseId -q '.[0].databaseId'`: `--commit` needs the full SHA, and the run can take a few seconds to appear and fix any failure before moving on. Pushing to `main` deploys to the public Pages site, and the user has accepted that.
- **Coding style is Ponytail `full`** (the plugin's default level): the smallest complete change, and a `shortcut: <limit>, <when to upgrade>` comment on every known limit.
- **Review before committing.** Spawn one read-only `general-purpose` subagent that runs the `ponytail:ponytail-review` skill on the task's diff (`git diff` against the last commit before the task). A fresh agent doesn't share the builder's blind spots. Its brief gives the task ID and tells it to read `CLAUDE.md`'s hard rules first. Fix the findings you confirm in the code, re-run the checks, and list dismissed findings with a one-line reason in the task report. Agents never play audio or open a browser.
- **Manual checks are batched, not blocking.** Add each one to **Manual checks waiting** in `PLAN.md`, mark the task `[built …, manual check pending]`, and carry on. How to write them is under "Manual checks" below.
- **Stop for the user only when:**
  1. a task should change what it delivers (rule 4 above, unchanged);
  2. an action is destructive: force-push, rewriting history, deleting user data, or a Dexie change without a migration;
  3. the next task appears in a waiting check's **blocks** list, three must-pass checks are waiting, or a phase is finished (all its tasks built). Then present the whole queue as one run (see below).
- Small implementation choices are yours: decide, add a decisions-log line if it matters later, and mention it in the end-of-task summary rather than asking.

## Sessions: the Main Agent and one session per task
The user's **Main Agent** session coordinates; each task runs in its own fresh session that the Main Agent starts, so no task inherits another's context.
- **Main Agent** writes no code. To run a task: check the stop rules above against `PLAN.md`, then start one session (`start_session`, fresh context, `use_worktree: false`, since it commits straight to `main` in this checkout) titled with the task ID, whose brief is the task ID and "follow the task-session loop in CLAUDE.md". Run **one task session at a time**: they share the checkout and `main`. When its report arrives, verify it (the commit is on `origin/main`, CI passed, the phase marker and queue are updated), then start the next task. Tell the user only what the stop rules say to; otherwise report progress in a line.
- **Models.** Phase tasks and the review subagent run on Opus (inherit; pass no `model`). Side jobs run on Sonnet (`model` set to the current Sonnet id): small fixes with a known cause or repro, doc-only updates (marking tasks done, Findings) and read-only checks. If plan limits get tight, move side jobs to Sonnet first and phase tasks last.
- **Side jobs alongside a task** get their own worktree (`use_worktree: true`) so they can't mix files with the task session in this checkout. They land by `git fetch`, `git rebase origin/main`, re-running the checks, then `git push origin HEAD:main` (fast-forward, never force), and leave `PLAN.md` to the Main Agent.
- **Task session loop:**
  1. Read this file, `PLAN.md`, the phase file and the docs named in "Before any work". If the task is in a waiting check's **blocks** list, stop and report that.
  2. Mark the heading `[in progress]`, build it with tests (pure logic test-first), and run every check.
  3. Review (above), fix, re-check.
  4. Update the phase marker, the status table, the queue and the decisions log; commit and push; confirm CI and fix it if it fails.
  5. Finish with a report whose first line is `<task ID>: done`, `<task ID>: built, manual check queued` or `<task ID>: blocked: <reason>`, then the commit hash, CI result, decisions made, review findings dismissed, and any `rules-allow` added.
- A task session only writes `PLAN.md` and the phase files for its own task. If the Main Agent ever runs two sessions at once, they must be read-only or in separate worktrees, and only the Main Agent edits `PLAN.md`.

## Manual checks
Batching means later tasks get built on checks you haven't done yet. These rules keep that safe.
- **Only hands, ears or the real keyboard.** Anything the simulated MIDI source, an offline render or Playwright can check is automated, never a manual check.
- **Each check script** has at most six steps, one setup line (browser, page, Local Control off), and for every step says what a pass sounds or looks like *and* what a failure looks like. Steps are labelled **must-pass** (works or doesn't: stuck notes, clicks, wrong sound, lag) or **taste** (a preference that becomes a default). Taste never blocks anything.
- **Queue entries** in `PLAN.md` give the task, the must-pass and taste step numbers, **blocks** (task IDs whose work depends on a must-pass result, or "none"), the browsers needed (both only when audio or MIDI timing changed), and minutes.
- **One run:** when work stops, the Main Agent gives the user one combined script for every waiting check, ordered so setup happens once.
- **Results are shorthand.** `P0-T6 pass`, `P0-T6 3 fail: F3 kept sounding`, `P0-T6 taste: split F3, left −1`. A pass marks the task `[done …]` and removes the entry. A failure becomes the next task: first reproduce it as an automated test (the simulated source, or a fixture recorded with the dev inspector), then fix it, so the same failure never needs checking by hand again. A taste answer becomes the default and gets a decisions-log line.

## Commands (Node 26)
```sh
npm run dev          # Vite dev server
npm run build        # tsc -b + vite build
npm run typecheck    # tsc -b
npm run lint         # oxlint (not ESLint)
npm run format       # Prettier write   (format:check in CI)
npm test             # Vitest unit tests: src/**/*.test.ts(x)
npm run test:e2e     # Playwright, Chromium + Firefox, tests/e2e/
npm run check:rules  # the hard rules a script can check (scripts/check-rules.ts)
```
Run typecheck, lint, format:check, test and check:rules before calling a task done. A line can opt out of one rule only with `// rules-allow: <rule>: <reason>`; use it rarely and mention each one in the task report. CI (`.github/workflows/ci.yml`) runs all of them, then deploys `main` to GitHub Pages (`VITE_BASE` is set to the repo sub-path there).

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
