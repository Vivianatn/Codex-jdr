import type { ReactNode } from 'react'

/**
 * Empty-state illustrations (DA §11.3): line drawings, 280 × 200, one gold
 * accent and one amethyst accent, colours from the --codex-ill-* tokens so
 * they follow the theme.
 */

const LINE = 'var(--codex-ill-line)'
const FILL = 'var(--codex-ill-fill)'
const FILL2 = 'var(--codex-ill-fill-2)'
const FAINT = 'var(--codex-ill-faint)'
const GOLD = 'var(--codex-gold-line)'
const ACCENT = 'var(--codex-ill-accent)'
const ACCENT_SOFT = 'var(--codex-ill-accent-soft)'
const SHADOW = 'var(--codex-ill-shadow)'

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 280 200"
      className="h-auto w-full max-w-[280px]"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const shadow = (rx = 112) => <ellipse cx="140" cy="182" rx={rx} ry="10" fill={SHADOW} />

/** Bestiary: an open grimoire with blank pages and a quill (the DA's own drawing). */
export function GrimoireIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow()}
      <path
        d="M140 52 C112 38 72 36 34 44 L34 168 C72 160 112 162 140 176 Z"
        fill={FILL}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path
        d="M140 52 C168 38 208 36 246 44 L246 168 C208 160 168 162 140 176 Z"
        fill={FILL}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path d="M140 52 L140 176" stroke={LINE} strokeWidth="1.5" />
      <path
        d="M54 74 C80 70 104 72 124 78 M54 92 C80 88 104 90 124 96 M54 110 C74 107 92 108 108 112"
        stroke={FAINT}
        strokeWidth="1.25"
        strokeDasharray="3 5"
      />
      <path
        d="M44 54 L44 64 M44 54 L54 54 M236 54 L236 64 M236 54 L226 54"
        stroke={GOLD}
        strokeWidth="1.25"
      />
      <path d="M193 98 L201 106 L193 114 L185 106 Z" stroke={GOLD} strokeWidth="1.25" />
      <circle cx="193" cy="106" r="1.6" fill={GOLD} />
      <path d="M166 106 L180 106 M206 106 L220 106" stroke={GOLD} strokeWidth="1" />
      <path d="M208 20 C228 26 238 48 226 72 L176 150" stroke={LINE} strokeWidth="1.5" />
      <path
        d="M208 20 C196 40 190 62 196 84 L176 150"
        stroke={LINE}
        strokeWidth="1.5"
        fill={FILL2}
      />
      <path d="M206 44 L220 46 M200 62 L216 66" stroke={LINE} strokeWidth="1" />
      <path d="M176 150 L170 162" stroke={LINE} strokeWidth="2" />
      <path
        d="M150 176 L150 196 L156 190 L162 196 L162 178"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth="1.25"
      />
    </Frame>
  )
}

/** Campaigns: a snuffed candle on a lectern, a wisp of smoke. */
export function CandleDeskIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(96)}
      <path d="M70 150 L210 150 L196 178 L84 178 Z" fill={FILL2} stroke={LINE} strokeWidth="1.5" />
      <path d="M62 142 L218 142 L218 150 L62 150 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path
        d="M92 142 C110 128 128 126 140 132 C152 126 170 128 188 142"
        fill={FILL}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path d="M140 132 L140 142" stroke={LINE} strokeWidth="1.25" />
      <path d="M128 70 L152 70 L152 128 L128 128 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path d="M128 78 C134 82 146 82 152 78" stroke={FAINT} strokeWidth="1.25" />
      <path d="M140 70 L140 60" stroke={LINE} strokeWidth="1.5" />
      <path
        d="M140 58 C134 48 146 42 140 32 C134 24 144 18 140 10"
        stroke={FAINT}
        strokeWidth="1.25"
        strokeDasharray="2 4"
      />
      <path
        d="M118 128 L162 128 L166 134 L114 134 Z"
        fill={FILL2}
        stroke={GOLD}
        strokeWidth="1.25"
      />
      <path
        d="M200 120 L210 112 L220 120 L210 128 Z"
        stroke={ACCENT}
        strokeWidth="1.25"
        fill={ACCENT_SOFT}
      />
    </Frame>
  )
}

/** Players: three empty medallions, the middle one gilded, a quill above. */
export function MedallionsIllustration({ label }: { label: string }) {
  const medallion = (cx: number, gold = false) => (
    <g key={cx}>
      <circle cx={cx} cy="112" r="34" fill={FILL} stroke={gold ? GOLD : LINE} strokeWidth="1.5" />
      <circle cx={cx} cy="112" r="27" stroke={gold ? GOLD : FAINT} strokeWidth="1" />
      <circle cx={cx} cy="104" r="8" stroke={FAINT} strokeWidth="1.25" />
      <path
        d={`M${cx - 14} 128 C${cx - 10} 116 ${cx + 10} 116 ${cx + 14} 128`}
        stroke={FAINT}
        strokeWidth="1.25"
      />
    </g>
  )
  return (
    <Frame label={label}>
      {shadow(110)}
      {medallion(62)}
      {medallion(140, true)}
      {medallion(218)}
      <path d="M150 20 C170 22 178 36 170 52 L136 66" stroke={LINE} strokeWidth="1.5" />
      <path
        d="M150 20 C142 32 140 44 144 56 L136 66"
        stroke={LINE}
        strokeWidth="1.5"
        fill={ACCENT_SOFT}
      />
      <path d="M136 66 L132 72" stroke={ACCENT} strokeWidth="2" />
    </Frame>
  )
}

/** Allies and familiars: a lantern and a small paw print. */
export function LanternIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(90)}
      <path d="M120 40 C120 24 160 24 160 40" stroke={LINE} strokeWidth="1.5" />
      <path d="M112 46 L168 46 L162 56 L118 56 Z" fill={FILL2} stroke={LINE} strokeWidth="1.5" />
      <path d="M118 56 L162 56 L158 140 L122 140 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path d="M140 56 L140 140 M120 98 L160 98" stroke={FAINT} strokeWidth="1" />
      <path
        d="M140 84 C134 92 134 104 140 110 C146 104 146 92 140 84 Z"
        fill={GOLD}
        fillOpacity="0.25"
        stroke={GOLD}
        strokeWidth="1.25"
      />
      <path
        d="M114 140 L166 140 L170 150 L110 150 Z"
        fill={FILL2}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <g stroke={ACCENT} fill={ACCENT_SOFT} strokeWidth="1.25">
        <ellipse cx="208" cy="166" rx="9" ry="7" />
        <circle cx="198" cy="152" r="3.5" />
        <circle cx="206" cy="148" r="3.5" />
        <circle cx="215" cy="149" r="3.5" />
        <circle cx="221" cy="157" r="3.5" />
      </g>
    </Frame>
  )
}

/** Items: an open, empty chest with two gold sparks. */
export function ChestIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(100)}
      <path d="M70 108 L210 108 L210 170 L70 170 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path d="M70 108 L82 60 L198 60 L210 108" fill={FILL2} stroke={LINE} strokeWidth="1.5" />
      <path d="M86 72 L194 72" stroke={FAINT} strokeWidth="1" />
      <path d="M70 128 L210 128" stroke={LINE} strokeWidth="1.25" />
      <path d="M132 120 L148 120 L148 138 L132 138 Z" fill={FILL} stroke={GOLD} strokeWidth="1.5" />
      <circle cx="140" cy="128" r="2" fill={GOLD} />
      <path d="M96 108 L96 170 M184 108 L184 170" stroke={FAINT} strokeWidth="1" />
      <path
        d="M112 36 L116 46 L126 50 L116 54 L112 64 L108 54 L98 50 L108 46 Z"
        fill={GOLD}
        fillOpacity="0.2"
        stroke={GOLD}
        strokeWidth="1.25"
      />
      <path
        d="M172 28 L174 34 L180 36 L174 38 L172 44 L170 38 L164 36 L170 34 Z"
        stroke={GOLD}
        strokeWidth="1.25"
      />
      <path
        d="M200 150 L210 142 L220 150 L210 158 Z"
        stroke={ACCENT}
        fill={ACCENT_SOFT}
        strokeWidth="1.25"
      />
    </Frame>
  )
}

/** Conditions: an hourglass, half its sand run through. */
export function HourglassIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(80)}
      <path
        d="M96 24 L184 24 L184 34 L96 34 Z M96 166 L184 166 L184 176 L96 176 Z"
        fill={FILL2}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path
        d="M108 34 C108 72 136 88 136 100 C136 112 108 128 108 166 L172 166 C172 128 144 112 144 100 C144 88 172 72 172 34 Z"
        fill={FILL}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path
        d="M122 62 C126 76 136 86 140 92 C144 86 154 76 158 62 Z"
        fill={GOLD}
        fillOpacity="0.25"
        stroke={GOLD}
        strokeWidth="1"
      />
      <path d="M140 100 L140 140" stroke={GOLD} strokeWidth="1" strokeDasharray="2 3" />
      <path
        d="M116 166 C120 148 132 140 140 140 C148 140 160 148 164 166 Z"
        fill={GOLD}
        fillOpacity="0.25"
        stroke={GOLD}
        strokeWidth="1"
      />
      <path
        d="M200 70 L208 62 L216 70 L208 78 Z"
        stroke={ACCENT}
        fill={ACCENT_SOFT}
        strokeWidth="1.25"
      />
    </Frame>
  )
}

/** Maps: a half-unrolled map with a gold compass rose. */
export function MapRollIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(110)}
      <path d="M48 52 L196 52 L196 160 L48 160 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path
        d="M196 52 C214 52 222 60 222 72 L222 172 C222 160 214 152 196 152"
        fill={FILL2}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path d="M196 52 L196 160" stroke={LINE} strokeWidth="1" />
      <path
        d="M62 132 C82 118 96 140 118 124 C134 112 146 124 160 112"
        stroke={FAINT}
        strokeWidth="1.25"
        strokeDasharray="4 4"
      />
      <path
        d="M70 76 L86 76 L86 92 L70 92 Z M100 70 C108 66 118 74 112 84"
        stroke={FAINT}
        strokeWidth="1.25"
      />
      <circle cx="160" cy="84" r="16" stroke={GOLD} strokeWidth="1.25" />
      <path
        d="M160 64 L164 84 L160 104 L156 84 Z M140 84 L160 80 L180 84 L160 88 Z"
        fill={GOLD}
        fillOpacity="0.2"
        stroke={GOLD}
        strokeWidth="1"
      />
      <path d="M118 124 L124 118 M118 118 L124 124" stroke={ACCENT} strokeWidth="2" />
    </Frame>
  )
}

/** Journal, notes, sessions: an inkwell and a quill, a page with a single line. */
export function InkwellIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(110)}
      <path d="M42 70 L162 62 L170 168 L50 176 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path d="M62 96 C90 92 116 94 146 90" stroke={FAINT} strokeWidth="1.25" />
      <path
        d="M62 116 C80 114 96 116 112 113"
        stroke={FAINT}
        strokeWidth="1.25"
        strokeDasharray="3 5"
      />
      <path
        d="M190 132 L238 132 L232 172 L196 172 Z"
        fill={FILL2}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path d="M200 132 C200 120 228 120 228 132" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path d="M196 150 L234 150" stroke={GOLD} strokeWidth="1.25" />
      <path d="M248 28 C262 40 260 64 240 82 L216 126" stroke={LINE} strokeWidth="1.5" />
      <path
        d="M248 28 C232 44 226 64 228 86 L216 126"
        stroke={LINE}
        strokeWidth="1.5"
        fill={ACCENT_SOFT}
      />
      <path d="M216 126 L212 134" stroke={ACCENT} strokeWidth="2" />
    </Frame>
  )
}

/** Skills: a closed book with a gold star and a few sparks. */
export function SpellbookIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(100)}
      <path d="M78 56 L192 50 L198 162 L84 170 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path d="M78 56 L70 62 L76 176 L84 170" fill={FILL2} stroke={LINE} strokeWidth="1.5" />
      <path d="M96 64 L184 60 L190 156 L102 162 Z" stroke={FAINT} strokeWidth="1" />
      <path
        d="M140 84 L147 102 L166 104 L151 116 L156 134 L140 124 L124 134 L129 116 L114 104 L133 102 Z"
        fill={GOLD}
        fillOpacity="0.2"
        stroke={GOLD}
        strokeWidth="1.25"
      />
      <path
        d="M214 50 L218 60 L228 64 L218 68 L214 78 L210 68 L200 64 L210 60 Z"
        stroke={ACCENT}
        fill={ACCENT_SOFT}
        strokeWidth="1.25"
      />
      <path
        d="M58 40 L60 46 L66 48 L60 50 L58 56 L56 50 L50 48 L56 46 Z"
        stroke={GOLD}
        strokeWidth="1"
      />
    </Frame>
  )
}

/** Search without result: a magnifier on a blank page. */
export function MagnifierIllustration({ label }: { label: string }) {
  return (
    <Frame label={label}>
      {shadow(100)}
      <path d="M70 44 L186 44 L186 170 L70 170 Z" fill={FILL} stroke={LINE} strokeWidth="1.5" />
      <path
        d="M88 70 L150 70 M88 88 L134 88"
        stroke={FAINT}
        strokeWidth="1.25"
        strokeDasharray="3 5"
      />
      <circle
        cx="170"
        cy="120"
        r="30"
        fill={FILL2}
        fillOpacity="0.6"
        stroke={LINE}
        strokeWidth="1.5"
      />
      <circle cx="170" cy="120" r="24" stroke={GOLD} strokeWidth="1" />
      <path d="M192 142 L222 172" stroke={LINE} strokeWidth="6" />
      <path d="M192 142 L222 172" stroke={ACCENT} strokeWidth="2" />
    </Frame>
  )
}
