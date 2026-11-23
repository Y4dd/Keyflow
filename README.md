# Keyflow

Learn piano for **synth soloing and comping over grooves** with your MIDI keyboard, right in the browser.

Keyflow is built for adults who know a bit of theory but can't yet play it without thinking. It mixes short, spaced practice drills with the fun part: soloing with a funk lead or a heavy wobble bass over original grooves, with the notes that fit lit up on the keys.

> **Status:** early development (Phase 0, Foundation). Nothing playable yet. See the [plan](PLAN.md).

## Planned features
- **Jam mode:** original electro-funk and soul grooves with live chord-tone and scale highlighting, record and replay.
- **Drills:** chords, scales and voicings with spaced repetition and hints that fade as you learn.
- **Comping:** play chord changes in time, scored on timing, voicing and rhythm.
- **Ear training:** call and response, scale degrees, find the key.
- **Song import:** loop and slow down songs you own (processed locally, never uploaded) and jam over them.
- **Sound lab:** build your own leads and basses.

## Requirements
- A USB MIDI keyboard (a computer keyboard and on-screen piano also work).
- Chrome, Edge or Firefox. Firefox asks you to install a small auto-generated add-on the first time a site uses MIDI. That's expected.

## Development
Requires Node 26 (see `.nvmrc`).

```sh
npm install
npm run dev          # start the dev server
npm run build        # typecheck and production build
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests in Chromium and Firefox (Playwright)
npm run lint         # oxlint
npm run format       # Prettier
```

Project docs: [PLAN.md](PLAN.md) (roadmap and decisions), [docs/architecture.md](docs/architecture.md), [docs/learning-design.md](docs/learning-design.md), [docs/phases/](docs/phases/).

## License
[MIT](LICENSE). All bundled musical content (grooves, licks, presets) is original.
