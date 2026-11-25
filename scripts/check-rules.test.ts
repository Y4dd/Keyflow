import { describe, expect, it } from 'vitest'
import {
  blank,
  checkLockfile,
  checkPackageJson,
  checkRepo,
  checkSource,
  licenseSatisfies,
} from './check-rules.ts'

const rules = (file: string, ...lines: string[]) =>
  checkSource(file, lines.join('\n')).map((v) => v.rule)

describe('blank', () => {
  it('removes comments but keeps line breaks and strings', () => {
    const out = blank("a // Tone.now()\n/* x\ny */ 'Tone.now()'")
    expect(out.split('\n')).toHaveLength(3)
    expect(out).not.toMatch(/\/\/|\/\*/)
    expect(out).toContain("'Tone.now()'")
  })

  it('can blank strings and template text but not template expressions', () => {
    const out = blank('const s = `a ${Tone.now()} b` + "window"', { strings: true })
    expect(out).toContain('Tone.now()')
    expect(out).not.toContain('window')
  })

  it("doesn't treat // inside a string as a comment", () => {
    expect(blank("const u = 'https://x'; Tone.now()")).toContain('Tone.now()')
  })
})

describe('tone-now', () => {
  const file = 'src/audio/tone/engine.ts'
  const tone = "import * as Tone from 'tone'"

  it('flags now() on Tone, its context and Transport, however it is reached', () => {
    expect(rules(file, tone, 'const t = Tone.now()')).toEqual(['tone-now'])
    expect(rules(file, tone, 'Tone?.now()')).toEqual(['tone-now'])
    expect(rules(file, tone, "Tone['now']()")).toEqual(['tone-now'])
    expect(rules(file, tone, 'Tone.getContext().now()')).toEqual(['tone-now'])
    expect(rules(file, tone, 'Tone.Transport.now()')).toEqual(['tone-now'])
    expect(rules(file, tone, 'const { now } = Tone')).toEqual(['tone-now'])
    expect(rules(file, "import * as $T from 'tone'", '$T.now()')).toEqual(['tone-now'])
  })

  it('flags importing or re-exporting now from tone', () => {
    expect(rules(file, "import { now, Synth } from 'tone'")).toEqual(['tone-now'])
    expect(rules(file, "import { now as t } from 'tone'")).toEqual(['tone-now'])
    expect(rules(file, "export { now } from 'tone'")).toEqual(['tone-now'])
  })

  it('ignores Tone.immediate(), clocks, comments and strings', () => {
    expect(
      rules(
        file,
        tone,
        'Tone.immediate() // not Tone.now()',
        "const label = 'Tone.now()'",
        'performance.now(); Date.now()',
      ),
    ).toEqual([])
  })

  it('only looks at now() calls in files that import tone', () => {
    expect(rules('src/input/midi/connection.ts', 'const t = env.now()')).toEqual([])
    expect(rules(file, tone, 'const t = env.now()')).toEqual(['tone-now'])
  })

  it('accepts an allow comment with a reason, on the line or alone on the line above', () => {
    expect(rules(file, tone, 'Tone.now() // rules-allow: tone-now: scheduled count-in')).toEqual([])
    expect(rules(file, tone, '// rules-allow: tone-now — scheduled', 'Tone.now()')).toEqual([])
    expect(rules(file, tone, 'Tone.now() // rules-allow: tone-now')).toEqual(['tone-now'])
    expect(rules(file, tone, 'Tone.now() // rules-allow: pure-module: wrong rule')).toEqual([
      'tone-now',
    ])
    expect(rules(file, tone, 'foo() // rules-allow: tone-now: for foo', 'Tone.now()')).toEqual([
      'tone-now',
    ])
  })

  it('skips test and spec files', () => {
    expect(rules('src/audio/tone/engine.test.ts', tone, 'Tone.now()')).toEqual([])
    expect(rules('src/audio/tone/engine.spec.ts', tone, 'Tone.now()')).toEqual([])
  })
})

describe('pure-module', () => {
  it('flags Tone, React and Dexie imports in pure folders', () => {
    expect(rules('src/music/scales.ts', "import * as Tone from 'tone'")).toEqual(['pure-module'])
    expect(rules('src/analysis/key.ts', "import { useState } from 'react'")).toEqual([
      'pure-module',
    ])
    expect(rules('src/practice/grade.ts', "import Dexie from 'dexie'")).toEqual(['pure-module'])
  })

  it('only allows value imports from other pure modules', () => {
    // A store import from pure audio code breaks both rules.
    expect(rules('src/audio/zones.ts', "import { useAudio } from '../state/audio'")).toEqual([
      'pure-module',
      'hot-path',
    ])
    expect(rules('src/music/x.ts', "import { s } from '../state'")).toEqual(['pure-module'])
    expect(rules('src/audio/voices.ts', "import { engine } from './engine'")).toEqual([
      'pure-module',
    ])
    expect(rules('src/music/x.ts', "const m = await import('./../ui/Panel.tsx')")).toEqual([
      'pure-module',
    ])
    expect(rules('src/music/x.ts', "import { save } from '../practice/storage/db'")).toEqual([
      'pure-module',
    ])
    expect(
      rules(
        'src/music/x.ts',
        "import { y } from './y'",
        "import { z } from '../analysis'",
        "import { PRESETS } from '../audio/presets/index.ts'",
        "import { kinds } from '../input/types.ts'",
      ),
    ).toEqual([])
  })

  it('treats import type and all-type inline imports as type-only', () => {
    expect(rules('src/music/x.ts', "import type { AudioState } from '../state/audio'")).toEqual([])
    expect(rules('src/music/x.ts', "import { type ToneT } from 'tone'")).toEqual([])
    expect(rules('src/music/x.ts', "import { type A, B } from 'tone'")).toEqual(['pure-module'])
  })

  it('ignores import text inside strings', () => {
    expect(rules('src/music/x.ts', "const s = `import x from 'react'`")).toEqual([])
    expect(rules('src/music/x.ts', `const s = "import x from 'react'"`)).toEqual([])
  })

  it('flags browser globals in use', () => {
    expect(rules('src/music/x.ts', 'const w = window.innerWidth')).toEqual(['pure-module'])
    expect(rules('src/input/midi/parse.ts', 'const t = performance.now()')).toEqual(['pure-module'])
    expect(rules('src/music/x.ts', 'globalThis.performance.now()')).toEqual(['pure-module'])
    expect(rules('src/music/x.ts', 'const c = new AudioContext()')).toEqual(['pure-module'])
    expect(rules('src/music/x.ts', "if (typeof window !== 'undefined') {}")).toEqual([
      'pure-module',
    ])
  })

  it("doesn't flag property names, parameters or types that share a global's name", () => {
    expect(
      rules(
        'src/practice/grade.ts',
        'interface Result { performance: number; window?: number }',
        'const r = { performance }',
        'function rolling(window: number, ctx: AudioContext) { return window + 1 }',
        "const d = options.document; const s = 'window'",
      ),
    ).toEqual([])
  })

  it('allows the storage folder and ignores code outside the pure paths', () => {
    expect(rules('src/practice/storage/db.ts', "import Dexie from 'dexie'")).toEqual([])
    expect(rules('src/audio/tone/voices.ts', "import * as Tone from 'tone'")).toEqual([])
    expect(rules('src/ui/App.tsx', 'window.addEventListener')).toEqual([])
  })
})

describe('hot-path', () => {
  it('flags React, Zustand, UI and store imports in audio and input code', () => {
    expect(rules('src/input/bus.ts', "import { useEffect } from 'react'")).toEqual(['hot-path'])
    expect(rules('src/input/bus.ts', "import { create } from 'zustand'")).toEqual(['hot-path'])
    expect(rules('src/input/bus.ts', "import { useMidi } from '../state/midi'")).toEqual([
      'hot-path',
    ])
    expect(
      rules('src/audio/tone/engine.ts', "import { Panel } from '../../ui/SoundPanel'"),
    ).toEqual(['hot-path'])
    expect(rules('src/audio/x.ts', "import { Panel } from '../ui'")).toEqual(['hot-path'])
  })

  it('allows type-only imports and code outside those folders', () => {
    expect(rules('src/input/bus.ts', "import type { ReactNode } from 'react'")).toEqual([])
    expect(rules('src/input/bus.ts', "import type { AudioState } from '../state/audio'")).toEqual(
      [],
    )
    expect(rules('src/state/audio.ts', "import { useEffect } from 'react'")).toEqual([])
  })
})

describe('licenses', () => {
  it('reads SPDX expressions', () => {
    const ok = ['MIT', 'Apache-2.0']
    expect(licenseSatisfies('MIT', ok)).toBe(true)
    expect(licenseSatisfies('(MIT OR GPL-3.0)', ok)).toBe(true)
    expect(licenseSatisfies('MIT AND GPL-3.0', ok)).toBe(false)
    expect(licenseSatisfies('', ok)).toBe(false)
  })

  it('requires permissive licenses for shipped packages only', () => {
    const lock = {
      packages: {
        '': {},
        'node_modules/ok': { license: 'MIT' },
        'node_modules/legacy': { license: { type: 'MIT' } },
        'node_modules/weird': { license: 'MPL-2.0' },
        'node_modules/missing': {},
        'node_modules/build-tool': { license: 'MPL-2.0', dev: true },
        'node_modules/dual': { license: '(MIT OR GPL-2.0)' },
      },
    }
    expect(checkLockfile(lock).map((v) => v.message.split(' ')[0])).toEqual(['weird', 'missing'])
  })

  it('rejects GPL-family licenses even for dev tools', () => {
    const lock = {
      packages: {
        'node_modules/a/node_modules/gpl': { license: 'LGPL-3.0', dev: true },
        'node_modules/constructor': { license: 'GPL-3.0', dev: true },
      },
    }
    expect(checkLockfile(lock)).toHaveLength(2)
  })
})

describe('notation', () => {
  it('flags notation renderers in any dependency field', () => {
    expect(checkPackageJson({ dependencies: { vexflow: '1', tone: '1' } })).toHaveLength(1)
    expect(checkPackageJson({ devDependencies: { abcjs: '1' } })).toHaveLength(1)
    expect(checkPackageJson({ peerDependencies: { verovio: '1' } })).toHaveLength(1)
  })
})

describe('the repo', () => {
  it('passes every hard-rule check', () => {
    expect(checkRepo()).toEqual([])
  })
})
