import type { ReactNode } from 'react'
import { LampEmber } from './LampEmber'

interface Props {
  children: ReactNode
  lampLit?: boolean
  lampLabel?: string
}

export function JournalShell({ children, lampLit = false, lampLabel }: Props) {
  return (
    <div className="journal-layout">
      <aside className="lamp-rail" aria-label="Scripture">
        <span className="lamp-rail__label">Scripture</span>
        <LampEmber lit={lampLit} label={lampLabel} />
      </aside>
      <main className="journal">{children}</main>
    </div>
  )
}
