# Learning Design

How Keyflow teaches, and why. Phase files link here. Change it by proposing the change and logging it in `PLAN.md`.

## Honesty note

There is little rigorous research on piano-learning apps specifically. Keyflow is built on **general, well-established findings from learning science and motor-skill research**, applied to piano. Don't claim in the app or README that Keyflow is "clinically proven" or cite specific effect sizes. Describe the principles instead. If a claim needs a citation, look it up and verify it before adding it.

## Principles → features

| Principle | What it means | Where Keyflow uses it |
|---|---|---|
| **Retrieval practice** | Recalling something strengthens it more than re-reading it. | Drills ask you to *produce* the chord or scale on the keys, not just recognize it. |
| **Spaced repetition** | Reviews spread out over growing intervals beat cramming. | Every skill item is an FSRS card, and the session builder serves what's due (Phase 2). |
| **Interleaving** | Mixing related skills feels harder but transfers better than practicing them in blocks. | Drill queues mix keys, chord qualities and inversions. The same item never appears twice in a row. |
| **Desirable difficulty / adaptive challenge** | Learning is best when you succeed most of the time, but not always. | Difficulty adapts toward a target success rate of roughly **80–85%** (a starting value, tuned with real data). |
| **Immediate, specific feedback, then fading** | Beginners need instant feedback; constant feedback later breeds dependence. | Per-note feedback at first. Hints and highlighting fade as an item stabilizes (see the hint ladder). |
| **Automaticity** | Fluent playing needs skills that are fast and effortless, not just correct. | **Response time** is graded, not just correctness. An item is mastered only when it is quick. |
| **Tempo ramping** | Accuracy first at a slow tempo, then speed it up. | Scales, comping and licks start slow and speed up about 5% after each clean pass. |
| **Chunking** | Experts see patterns (shapes, progressions), not single notes. | Teach chord *shapes*, Roman-numeral progressions and licks as units. |
| **Variable practice** | Practicing a skill in varied contexts makes it more transferable. | The same chord in different keys, inversions, registers, grooves and tempos. |
| **Distributed short sessions** | Several short sessions beat one long one. | A 5-minute daily core, with optional longer play on top. |
| **Adult motivation (autonomy, relevance)** | Adults learn best when they choose and the material matters to them. | You pick focus areas. Content is the music you want: funk and soul soloing, comping, bass. Jamming is always one click away. |

## Skill items

Everything learnable is an **item** with an ID and its own FSRS card. One item is the smallest unit that can be scheduled.

ID scheme: `<type>:<segments…>`, colon-separated. The segments depend on the type. Chord and scale items follow `<type>:<root>:<quality>:<variant>`.

**Shared quality vocabulary** (use exactly these ids everywhere):
- chords: `maj`, `min`, `dim`, `aug`, `sus2`, `sus4`, `maj7`, `m7`, `7`, `m7b5`, `maj9`, `m9`, `9`
- scales: `major`, `minor`, `minPent`, `majPent`, `blues`, `dorian`, `mixolydian`
- variants: `root`, `inv1`, `inv2`, `inv3`, `any`, `asc1`, `desc1`, `updown1`

Examples:
- `geo:F#`: find F♯ anywhere on the keyboard
- `chord:E:min:root`: E minor triad, root position
- `chord:E:min:inv1`: E minor triad, 1st inversion
- `chord:F:m7:any`: Fm7, any voicing
- `scale:A:minPent:asc1`: A minor pentatonic, ascending one octave
- `rn:G:major:vi`: the vi chord in G (chord in key; a minor key writes `rn:A:minor:bVII`)
- `prog:ii-V-I:Bb`: ii–V–I in B♭
- `ear:degree:5`: hear scale degree 5 in a key
- `lick:<lickId>:<key>`: an original lick in a key (Phase 6)

Items unlock along a **curriculum graph** of prerequisites (Phase 2). For example, `chord:*:m7:*` unlocks after the minor triads are stable in about six keys.

## Grading → FSRS rating

Each attempt produces a rating:

| Rating | Condition (starting thresholds, tunable) |
|---|---|
| Again | Wrong after the full hint ladder, gave up, **or needed hint level 3 (the answer was shown)**, even if it was then played correctly |
| Hard | Correct but slower than the **target time**, or needed hint level 1–2 |
| Good | Correct with no hints, within the target time |
| Easy | Correct with no hints, under half the target time, no wrong notes |

Starting target times: single notes 2 s, triads 3 s, 7th chords 4 s, one-octave scales measured at the target tempo. Store the thresholds in config, not in code.

## Hint ladder (scaffold, then fade)

When an attempt stalls, hints appear in steps. **The delay before the first hint grows with the item's FSRS stability**, so well-known items get time to be recalled unaided.

1. **Anchor:** highlight the root key.
2. **Method:** show the formula ("minor = root, +3 half-steps, +4 half-steps") with half-step counting shown on the keys.
3. **Answer:** show the full shape on the keys, then ask for it again unaided.

Using a hint caps the rating (see the table). The goal is that the learner can **work it out alone** (step 2), then eventually **just know it**.

## Session structure

- **Core (about 5 min):** due reviews first, then 2–4 new items. This is the daily habit.
- **Apply (optional):** jam or comp with today's material, for example soloing with the scale just reviewed.
- **Free play (optional, open-ended):** jam mode, sound lab, songs.
- Keep streaks gentle: show consistency, but never punish a missed day.

## Feedback tone

- In jam mode, out-of-scale notes are **dimmed, never red**. In improvising there are no wrong notes, only choices.
- Post-take feedback gives **one** concrete suggestion, not a report card.
- Drills can be strict. Jamming is never graded unless the user opts into a solo-coaching exercise (Phase 4).
