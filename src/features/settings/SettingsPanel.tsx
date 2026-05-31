import { useEffect } from 'react'
import type { Settings } from '@/lib/settings'
import { settingsStore } from '@/lib/settings'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onClose: () => void
}

const THEMES = [{ value: 'one-dark', label: 'One Dark' }]

export function SettingsPanel({ settings, update, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" style={{ zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 26rem)',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem 1.4rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
            Settings
          </h2>
          <button className="btn btn--ghost" onClick={onClose}>✕</button>
        </div>

        <Field label="Theme">
          <select
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value })}
            style={selectStyle}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Slider
          label="Font size"
          value={settings.fontSize}
          min={13}
          max={22}
          step={1}
          suffix="px"
          onChange={(v) => update({ fontSize: v })}
        />
        <Slider
          label="Line height"
          value={settings.lineHeight}
          min={1.3}
          max={2.1}
          step={0.05}
          onChange={(v) => update({ lineHeight: v })}
        />
        <Slider
          label="Column width"
          value={settings.maxWidth}
          min={32}
          max={60}
          step={1}
          suffix="rem"
          onChange={(v) => update({ maxWidth: v })}
        />

        <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '1rem 0', paddingTop: '0.5rem' }}>
          <Toggle label="Typewriter scrolling" hint="Active line centered (focus mode)" checked={settings.typewriter} onChange={(v) => update({ typewriter: v })} />
          <Toggle label="Paragraph dimming" hint="Fade all but the current paragraph (focus mode)" checked={settings.dimming} onChange={(v) => update({ dimming: v })} />
        </div>

        <button className="btn btn--ghost" style={{ marginTop: '0.5rem' }} onClick={() => settingsStore.reset()}>
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-bright)',
  padding: '0.4rem 0.6rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.7rem 0' }}>
      <span style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{label}</span>
      {children}
    </div>
  )
}

function Slider({
  label, value, min, max, step, suffix = '', onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ margin: '0.7rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{label}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
          {Number.isInteger(value) ? value : value.toFixed(2)}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.4rem 0', cursor: 'pointer' }}>
      <span>
        <span style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{label}</span>
        {hint && <span style={{ display: 'block', color: 'var(--text-faint)', fontSize: '0.72rem' }}>{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
    </label>
  )
}
