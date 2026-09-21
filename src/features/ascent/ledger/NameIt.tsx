import { useState } from 'react'
import { useSettings } from '@/hooks/useSettings'

/** The writer's name for a month or season, if they gave one. */
export function usePeriodName(key: string): [string, (name: string) => void] {
  const { settings, update } = useSettings()
  const name = settings.periodNames?.[key] ?? ''
  const set = (next: string) => {
    const names = { ...(settings.periodNames ?? {}) }
    if (next.trim()) names[key] = next.trim()
    else delete names[key]
    update({ periodNames: names })
  }
  return [name, set]
}

/**
 * A name beside the calendar's: "June 2026 · The month I gave notice". The app
 * never names a stretch of time itself — only the writer does, and only if they
 * want to. Leaving it blank is the default and says nothing.
 */
export function NameIt({ name, onName }: { name: string; onName: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        className="name-it__input"
        autoFocus
        defaultValue={name}
        placeholder="Call it something — or leave it"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onName((e.target as HTMLInputElement).value)
            setEditing(false)
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        onBlur={(e) => {
          onName(e.target.value)
          setEditing(false)
        }}
      />
    )
  }
  return (
    <span className="name-it">
      {name ? <em className="name-it__name">· {name}</em> : null}
      <button type="button" className="name-it__edit" onClick={() => setEditing(true)}>
        {name ? 'rename' : '+ give it a name'}
      </button>
    </span>
  )
}
