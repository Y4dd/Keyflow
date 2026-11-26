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
}

export function SleeveArt({ presetId }: { presetId: PresetId }) {
  return (
    <svg className="art" viewBox="0 0 140 140" aria-hidden="true">
      {ART[presetId]}
    </svg>
  )
}
