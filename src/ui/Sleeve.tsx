import type { JSX } from 'react'
import type { PresetId } from '../audio/presets/types.ts'

// Original sleeve art for each preset, drawn in its sound colour (docs/design/theme.md).
const ART: Record<PresetId, JSX.Element> = {
  'funk-lead': (
    <>
      <rect width="140" height="140" fill="#ff7b2e" />
      <path d="M0 140 L140 30 L140 140 Z" fill="#d95f17" />
      <path d="M0 112 L140 2" stroke="#f1e8da" strokeWidth="6" />
    </>
  ),
  'wobble-bass': (
    <>
      <rect width="140" height="140" fill="#ff7fae" />
      <path
        d="M0 50 Q17.5 30 35 50 T70 50 T105 50 T140 50 V80 Q122.5 100 105 80 T70 80 T35 80 T0 80 Z"
        fill="#d9578a"
      />
      <path
        d="M0 104 Q17.5 84 35 104 T70 104 T105 104 T140 104"
        stroke="#f1e8da"
        strokeWidth="5"
        fill="none"
      />
    </>
  ),
  'ep-keys': (
    <>
      <rect width="140" height="140" fill="#7cc4f2" />
      <circle cx="92" cy="52" r="44" fill="#4f9fd4" />
      <circle cx="92" cy="52" r="26" fill="none" stroke="#f1e8da" strokeWidth="5" />
      <circle cx="92" cy="52" r="7" fill="#1c1512" />
    </>
  ),
  // P1-T3b candidates. Round: soft rings blooming from a corner.
  'round-bass': (
    <>
      <rect width="140" height="140" fill="#a28bff" />
      <circle cx="0" cy="140" r="112" fill="#7a62d9" />
      <circle cx="0" cy="140" r="78" fill="none" stroke="#f1e8da" strokeWidth="6" />
      <circle cx="0" cy="140" r="40" fill="#1c1512" />
    </>
  ),
  // Pluck: a struck string, its swing dying away.
  'finger-pluck': (
    <>
      <rect width="140" height="140" fill="#3fcfc0" />
      <path d="M0 140 V96 L140 60 V140 Z" fill="#25a397" />
      <path
        d="M0 70 L14 26 L28 108 L44 44 L60 92 L78 58 L96 80 L114 66 L140 70"
        stroke="#f1e8da"
        strokeWidth="5"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  // Velvet: low bands, heavier the deeper they sit.
  'velvet-sub': (
    <>
      <rect width="140" height="140" fill="#dd8cf2" />
      <rect y="62" width="140" height="10" fill="#b25fcb" />
      <rect y="82" width="140" height="18" fill="#b25fcb" />
      <rect y="110" width="140" height="30" fill="#b25fcb" />
      <rect y="40" width="140" height="4" fill="#f1e8da" />
    </>
  ),
  // Rubber: a ball bouncing lower each time.
  'rubber-bass': (
    <>
      <rect width="140" height="140" fill="#bfe04f" />
      <rect y="112" width="140" height="28" fill="#94b52c" />
      <path
        d="M6 112 Q30 10 54 112 Q72 46 90 112 Q103 74 116 112 Q124 96 132 112"
        stroke="#f1e8da"
        strokeWidth="5"
        fill="none"
      />
      <circle cx="30" cy="47" r="11" fill="#1c1512" />
    </>
  ),
}

export function SleeveArt({ presetId }: { presetId: PresetId }) {
  return (
    <svg className="art" viewBox="0 0 140 140" aria-hidden="true">
      {ART[presetId]}
    </svg>
  )
}
