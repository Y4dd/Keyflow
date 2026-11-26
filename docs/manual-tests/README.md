# Manual tests waiting

Checks only the user can do: hands, ears, the real YPT-380. Each one that is waiting has a file here, named after its task: `P1-T1.md`. The folder holds only the waiting ones, so an empty folder (just this README) means nothing is waiting.

- **Written by** the task session that built the task, at build time. The phase file states the checks as part of the task's spec; the runnable script lives here. How a script is written (six steps at most, one setup line, a pass and a failure for every step, must-pass or taste) is under "Manual checks" in [`CLAUDE.md`](../../CLAUDE.md).
- **Queued in** the "Manual checks waiting" table in [`PLAN.md`](../../PLAN.md), which links each file and lists its must-pass and taste steps, what it blocks, the browsers and the minutes.
- **Run together:** when work stops, the Main Agent gives one run order across the waiting files, so setup happens once.
- **Results are shorthand** in chat: `P1-T1 pass`, `P1-T1 3 fail: <what happened>`, `P1-T1 taste: <choice>`.
- **On a pass** the result goes into the phase file, the task is marked `[done …]`, this file is deleted and its queue row removed. **On a failure** the file stays until a re-check after the fix passes.
