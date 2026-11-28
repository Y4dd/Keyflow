// Checks the hard rules in CLAUDE.md that a script can check, so they don't depend on anyone
// remembering them. Run with `npm run check:rules` (CI runs it too).
//
// A line can opt out of one rule with a comment on the same line or the line above:
//   // rules-allow: tone-now: scheduled count-in, not live input
// The reason is required.

import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'

export type RuleId = 'tone-now' | 'pure-module' | 'hot-path' | 'license' | 'notation'

export interface Violation {
  rule: RuleId
  file: string
  /** 1-based; 0 when the finding is about the whole file. */
  line: number
  message: string
}

/** Files that must stay pure: no DOM, no Tone.js, no React, no app state (architecture.md). */
export const PURE_PATHS = [
  'src/music/',
  'src/analysis/',
  'src/practice/',
  'src/input/midi/parse.ts',
  'src/input/sim/script.ts',
  'src/audio/voices.ts',
  'src/audio/zones.ts',
  'src/audio/curves.ts',
  'src/audio/expression.ts',
  'src/audio/mixer.ts',
  'src/audio/calibration.ts',
  'src/audio/presets/',
  'src/grooves/',
]
/** `practice/` may call storage (architecture.md); keep those calls in this folder. */
export const PURE_EXEMPT = ['src/practice/storage/']

const IMPURE_PACKAGES = ['tone', 'react', 'react-dom', 'zustand', 'dexie']
/**
 * Files outside PURE_PATHS that pure code may still import with a value import: shared, pure
 * type-and-constant modules only. Type-only imports are always fine.
 */
export const PURE_SHARED = ['src/input/types.ts']
const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'AudioContext',
  'OfflineAudioContext',
  'requestAnimationFrame',
  'performance',
]
/**
 * Folders on the audio hot path. MIDI reaches the engine directly; React and the stores are told
 * afterwards (architecture.md), so this code never imports them.
 */
const HOT_PATH_DIRS = ['src/audio/', 'src/input/']
const HOT_PATH_FORBIDDEN_PACKAGES = ['react', 'react-dom', 'zustand']
const HOT_PATH_FORBIDDEN_DIRS = ['src/ui/', 'src/state/']

export const PERMISSIVE_LICENSES = [
  'MIT',
  'MIT-0',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
]
const COPYLEFT = /\b(A?GPL|LGPL|SSPL)/i
/**
 * Packages allowed despite the license rule. Each needs a dated decision in PLAN.md's
 * decisions log; put the date here as the value.
 */
export const LICENSE_EXCEPTIONS: Record<string, string> = {}

/** Notation renderers: Keyflow has no sheet music anywhere. */
export const NOTATION_PACKAGES = ['vexflow', 'abcjs', 'opensheetmusicdisplay', 'verovio', 'abc2svg']

/**
 * Replaces comments (and, if asked, string contents) with spaces, keeping every line break, so
 * the rules match code only and line numbers stay right. Regex literals aren't recognized;
 * none of the patterns checked here are likely inside one.
 */
export function blank(source: string, options: { strings?: boolean } = {}): string {
  let out = ''
  let i = 0
  // Each entry is an open template literal; the number is the `${` depth inside it.
  const templates: number[] = []
  const keep = (ch: string, isString: boolean) =>
    (out += isString && options.strings && ch !== '\n' ? ' ' : ch)
  const space = (ch: string) => (out += ch === '\n' ? '\n' : ' ')

  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    const inTemplateText = templates.length > 0 && templates[templates.length - 1] === 0

    if (inTemplateText) {
      if (ch === '\\') {
        keep(ch, true)
        if (next !== undefined) keep(next, true)
        i += 2
      } else if (ch === '`') {
        templates.pop()
        out += ch
        i++
      } else if (ch === '$' && next === '{') {
        templates[templates.length - 1] = 1
        out += '${'
        i += 2
      } else {
        keep(ch, true)
        i++
      }
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') space(source[i++])
    } else if (ch === '/' && next === '*') {
      space(source[i++])
      space(source[i++])
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) space(source[i++])
      if (i < source.length) {
        space(source[i++])
        space(source[i++])
      }
    } else if (ch === "'" || ch === '"') {
      out += ch
      i++
      while (i < source.length && source[i] !== ch && source[i] !== '\n') {
        if (source[i] === '\\' && i + 1 < source.length) keep(source[i++], true)
        keep(source[i++], true)
      }
      if (i < source.length) out += source[i++]
    } else if (ch === '`') {
      templates.push(0)
      out += ch
      i++
    } else {
      if (templates.length > 0) {
        if (ch === '{') templates[templates.length - 1]++
        if (ch === '}') templates[templates.length - 1]--
      }
      out += ch
      i++
    }
  }
  return out
}

function lineAt(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++
  return line
}

/** An opt-out comment on the same line, or alone on the line above. */
function allowed(lines: string[], line: number, rule: RuleId): boolean {
  const marker = `rules-allow:\\s*${rule}\\s*[:—-]\\s*\\S`
  const same = lines[line - 1]
  const above = lines[line - 2]
  return (
    (same !== undefined && new RegExp(marker).test(same)) ||
    (above !== undefined && new RegExp(`^\\s*//.*${marker}`).test(above))
  )
}

interface ImportRef {
  specifier: string
  typeOnly: boolean
  line: number
}

const isTypeOnlyClause = (clause: string) => {
  const named = clause.trim().match(/^\{([^}]*)\}$/)
  if (!named) return false
  const items = named[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length > 0 && items.every((item) => /^type\s/.test(item))
}

/** Finds imports and re-exports in `code` (comments blanked); `bare` has strings blanked too. */
export function findImports(
  code: string,
  bare: string = blank(code, { strings: true }),
): ImportRef[] {
  const refs: ImportRef[] = []
  const patterns = [
    /\b(?:import|export)\s+(type\s+)?([\w*{}\s,$]*?)\s*\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ]
  for (const [n, pattern] of patterns.entries()) {
    for (const m of code.matchAll(pattern)) {
      // An "import" inside a string or template text is blanked in `bare`: not a real import.
      if (bare[m.index] !== code[m.index]) continue
      refs.push({
        specifier: n === 0 ? m[3] : m[1],
        typeOnly: n === 0 && (m[1] !== undefined || isTypeOnlyClause(m[2])),
        line: lineAt(code, m.index),
      })
    }
  }
  return refs
}

const startsWithAny = (file: string, prefixes: string[]) => prefixes.some((p) => file.startsWith(p))
const packageName = (spec: string) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function resolveRelative(file: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  return posix.normalize(posix.join(posix.dirname(file), spec))
}

/** True if `resolved` (a file, a file without its extension, or a folder) is in `paths`. */
function inPaths(resolved: string, paths: string[]): boolean {
  return paths.some((p) =>
    p.endsWith('/')
      ? `${resolved}/`.startsWith(p)
      : resolved === p || resolved === p.replace(/\.ts$/, ''),
  )
}

const isPureTarget = (resolved: string) =>
  !resolved.endsWith('.tsx') &&
  !inPaths(resolved, PURE_EXEMPT) &&
  (inPaths(resolved, PURE_PATHS) || inPaths(resolved, PURE_SHARED))

const GLOBALS = BROWSER_GLOBALS.join('|')
/**
 * A browser global being used: called, indexed or read from (`performance.now()`), reached
 * through `globalThis`, `self` or `window`, constructed, or tested with `typeof`. Property names
 * (`{ performance: 1 }`, `x.window`), parameters and type annotations don't match.
 */
const GLOBAL_USE = new RegExp(
  [
    `(?<![\\w$.])(${GLOBALS})(?=\\s*(?:\\?\\.|\\.|\\[|\\())`,
    `\\b(?:globalThis|self|window)\\s*\\??\\.\\s*(${GLOBALS})\\b`,
    `\\bnew\\s+(${GLOBALS})\\b`,
    `\\btypeof\\s+(${GLOBALS})\\b`,
  ].join('|'),
  'g',
)
/** Receivers whose now() is a clock reading, not Tone's look-ahead time. */
const CLOCKS = ['performance', 'Date']

/** Checks one source file. `file` is a repo-relative path with forward slashes. */
export function checkSource(file: string, source: string): Violation[] {
  if (/\.(test|spec)\.[cm]?tsx?$/.test(file) || file.endsWith('.d.ts')) return []
  const lines = source.split('\n')
  const code = blank(source)
  const bare = blank(source, { strings: true })
  const found: Violation[] = []
  const add = (rule: RuleId, line: number, message: string) => {
    if (!allowed(lines, line, rule)) found.push({ rule, file, line, message })
  }
  const imports = findImports(code, bare)

  // Live notes use Tone.immediate(). Tone.now(), and now() on Tone's context or Transport, add
  // the look-ahead (Tone's Context.now() is currentTime + lookAhead).
  if (imports.some((ref) => ref.specifier === 'tone' && !ref.typeOnly)) {
    const message = 'now() in Tone adds look-ahead: use Tone.immediate() for live input'
    for (const m of bare.matchAll(/([\w$]+)?\s*(?:\?\.|\.)\s*now\s*\(/g)) {
      if (!CLOCKS.includes(m[1] ?? '')) add('tone-now', lineAt(bare, m.index), message)
    }
    for (const m of code.matchAll(/\[\s*['"]now['"]\s*\]/g))
      add('tone-now', lineAt(code, m.index), message)
    const namespaces = ['Tone']
    for (const m of code.matchAll(/\bimport\s*\*\s*as\s+([\w$]+)\s+from\s*['"]tone['"]/g))
      namespaces.push(m[1])
    const fromTone = `(?:${namespaces.map(escapeRegExp).join('|')})(?![\\w$])`
    const destructure = new RegExp(`\\{[^{}]*\\bnow\\b[^{}]*\\}\\s*=\\s*${fromTone}`, 'g')
    for (const m of bare.matchAll(destructure)) add('tone-now', lineAt(bare, m.index), message)
  }
  const namedFromTone = /\b(?:import|export)\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]tone['"]/g
  for (const m of code.matchAll(namedFromTone)) {
    if (/(^|[\s,])now(\s|,|$)/.test(m[1]))
      add('tone-now', lineAt(code, m.index), `importing now from 'tone': use Tone.immediate()`)
  }

  if (startsWithAny(file, PURE_PATHS) && !startsWithAny(file, PURE_EXEMPT)) {
    for (const ref of imports) {
      if (ref.typeOnly) continue
      const resolved = resolveRelative(file, ref.specifier)
      if (resolved === null && IMPURE_PACKAGES.includes(packageName(ref.specifier)))
        add('pure-module', ref.line, `pure module imports '${ref.specifier}'`)
      else if (resolved !== null && !isPureTarget(resolved))
        add(
          'pure-module',
          ref.line,
          `pure module imports '${ref.specifier}', which isn't pure (if it is, add it to PURE_PATHS)`,
        )
    }
    for (const m of bare.matchAll(GLOBAL_USE)) {
      const name = m[1] ?? m[2] ?? m[3] ?? m[4]
      add('pure-module', lineAt(bare, m.index), `pure module uses the browser global ${name}`)
    }
  }

  if (startsWithAny(file, HOT_PATH_DIRS) && /\.[cm]?ts$/.test(file)) {
    for (const ref of imports) {
      if (ref.typeOnly) continue
      const resolved = resolveRelative(file, ref.specifier)
      const bad =
        resolved === null
          ? HOT_PATH_FORBIDDEN_PACKAGES.includes(packageName(ref.specifier))
          : inPaths(resolved, HOT_PATH_FORBIDDEN_DIRS)
      if (bad)
        add(
          'hot-path',
          ref.line,
          `audio/input code imports '${ref.specifier}' (React and the stores are told afterwards)`,
        )
    }
  }

  return found
}

/** True if an SPDX expression can be satisfied with licenses from `permitted`. */
export function licenseSatisfies(expression: string, permitted: string[]): boolean {
  const cleaned = expression.replace(/[()]/g, ' ').trim()
  if (cleaned === '') return false
  return cleaned
    .split(/\s+OR\s+/i)
    .some((alternative) =>
      alternative.split(/\s+AND\s+/i).every((id) => permitted.includes(id.trim())),
    )
}

interface LockPackage {
  license?: unknown
  dev?: boolean
}

/** Lockfiles normally hold an SPDX string; very old packages may have `{ type }` instead. */
function licenseOf(pkg: LockPackage): string {
  const { license } = pkg
  if (typeof license === 'string') return license
  if (license !== null && typeof license === 'object' && 'type' in license)
    return String(license.type)
  return ''
}

export function checkLockfile(lock: { packages?: Record<string, LockPackage> }): Violation[] {
  const found: Violation[] = []
  for (const [path, pkg] of Object.entries(lock.packages ?? {})) {
    if (path === '') continue
    const name = path.replace(/^.*node_modules\//, '')
    if (Object.hasOwn(LICENSE_EXCEPTIONS, name)) continue
    const license = licenseOf(pkg)
    const add = (message: string) =>
      found.push({ rule: 'license', file: 'package-lock.json', line: 0, message })
    if (COPYLEFT.test(license) && !licenseSatisfies(license, PERMISSIVE_LICENSES))
      add(`${name} is ${license}: GPL-family licenses need a logged decision in PLAN.md`)
    else if (!pkg.dev && !licenseSatisfies(license, PERMISSIVE_LICENSES))
      add(
        `${name} ships with the app and is '${license || 'unlicensed'}' (allowed: MIT, Apache-2.0, BSD, ISC; anything else needs a logged decision and a LICENSE_EXCEPTIONS entry)`,
      )
  }
  return found
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

export function checkPackageJson(
  pkg: Partial<Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>>,
): Violation[] {
  const names = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(pkg[field] ?? {}))
  return names
    .filter((name) => NOTATION_PACKAGES.includes(name))
    .map((name) => ({
      rule: 'notation' as const,
      file: 'package.json',
      line: 0,
      message: `${name} renders notation; Keyflow has no sheet music`,
    }))
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.([cm]?ts|tsx)$/.test(entry.name))
    .map((entry) => posix.join(entry.parentPath.replaceAll('\\', '/'), entry.name))
}

export function checkRepo(): Violation[] {
  const files = sourceFiles('src')
  return [
    ...files.flatMap((file) => checkSource(file, readFileSync(file, 'utf8'))),
    ...checkLockfile(JSON.parse(readFileSync('package-lock.json', 'utf8'))),
    ...checkPackageJson(JSON.parse(readFileSync('package.json', 'utf8'))),
  ]
}

if (import.meta.main) {
  const violations = checkRepo()
  for (const v of violations)
    console.error(`${v.file}${v.line ? `:${v.line}` : ''}  [${v.rule}] ${v.message}`)
  if (violations.length > 0) {
    console.error(`\n${violations.length} hard-rule violation(s). See CLAUDE.md, "Hard rules".`)
    process.exit(1)
  }
  console.log('Hard rules: all checks pass.')
}
