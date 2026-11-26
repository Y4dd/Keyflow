# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One adult learner first (the author), then anyone who finds the open-source app. They practise 5 to 60 minutes a day, mostly **in the evening in a dim room**: a 61-key Yamaha YPT-380 on a stand with the Windows laptop beside it, hands on the keys, glancing at the screen. They know fragmented basic theory (C major yes, E minor no) and want to **solo and comp by ear over electro-funk and soul grooves with synth sounds**. Priorities in order: solo, comping, chords, leads, songs.

## Product Purpose

Keyflow teaches synth soloing and comping through a MIDI keyboard by doing: a built-in synth that sounds good from the first note, jam mode over original grooves with live chord-tone highlighting, spaced and interleaved drills, comping and ear training. Success is the learner playing more, and soloing by ear over a groove with notes that fit.

## Positioning

Grooves are pattern data, not audio, so the app always knows the current chord and can light the notes that fit while you play. It teaches synth-lead playing (glide, bends without a bend wheel, split bass and lead), not classical piano, and never uses sheet music.

## Operating Context

- Hands are on the keyboard; the screen is read at a glance from a stand's distance. The laptop's keys and mouse are a fallback (computer-key piano, on-screen keys, a laptop bend key).
- Setup happens once per session at most: connect the keyboard (Firefox shows a site-permission add-on prompt; Chrome asks to allow MIDI), start audio with a click, turn the keyboard's Local Control off.
- Current screens: MIDI onboarding and device panel; Sound panel (split point, left and main sounds, presets and their knobs, pedal mode, bends); Play panel with the 61-key canvas keyboard and held-note readout; Timing calibration. Jam mode, drills and comping come next and build on this UI.

## Capabilities and Constraints

- Local-first: no backend, no accounts, no third-party requests at runtime. Fonts, icons and images are self-hosted with their licenses in `assets/LICENSES.md`.
- Firefox and Chrome, desktop. Phones are not a target.
- Audio and input never go through React; the canvas keyboard draws in an animation frame after a change.
- Terminology: main sound and left sound (the split), Sustain / Bend / Glide-hold (pedal modes), presets Funk Lead, Wobble Bass, EP Keys. Note names spelled by key at the display boundary; C4 is middle C.

## Brand Commitments

- Name: Keyflow. MIT, open source.
- **No sheet music or notation anywhere.** Prompts use note names, chord symbols and Roman numerals.
- **Feedback tone:** out-of-scale notes are dimmed, never red. One suggestion, never a report card.
- Original content only; nothing named after or styled on real artists, songs or products.
- The user ruled out: childish or gamified (badges, mascots, confetti), intimidating pro gear (a DAW or hardware-rack look), and generic SaaS (cards, gradients, a blue button).

## Evidence on Hand

No screenshots, testimonials or recordings ship. The app's own synth sounds and the canvas keyboard are the demonstration.

## Product Principles

1. Playing comes first: the keyboard and the sound are always one step away.
2. A first visit makes the next step obvious; settings stay out of the way until wanted.
3. Gentle and encouraging, never graded harshly.
4. Instant: nothing on screen may make playing feel slower.

## Accessibility & Inclusion

Keyboard-reachable controls (Space is the bend key, but a control reached with Tab keeps Space), readable at a stand's distance in a dim room, and meaning never carried by colour alone.
