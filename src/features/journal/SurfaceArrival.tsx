import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'
import { isEmberLit } from './surfaceEmbers'
import {
  clearSurfaceUpdates,
  peekSurfaceUpdates,
  type UpdateSurface,
} from './surfaceUpdates'
import './SurfaceArrival.css'

/**
 * The arrival line — what closes the loop between the rail glow and the surface.
 *
 * A glowing rail dot promised "something new in here"; this is the surface
 * answering "here's what." It reads, once at mount, the items recorded since the
 * last visit (surfaceUpdates) and whether the one-time discovery ember is lit
 * (surfaceEmbers), then either names the new items or — when there's nothing to
 * name (e.g. a finished backfill that lit every surface at once) — offers a quiet
 * orientation line so the destination still introduces itself. Dismissible, and
 * self-extinguishing: opening the surface consumes the updates.
 *
 * Capture is a useState initializer on purpose: it runs during the first render,
 * before any effect — so it sees the lit ember and pending items a beat before
 * the visit clears them. Surfaces that also want to highlight (Scripture pulses
 * the books that gained verses) must likewise peek in their own initializer,
 * which runs before this child's clear effect.
 */

const DISCOVERY_COPY: Record<UpdateSurface, { lead: string; body: string }> = {
  scripture: {
    lead: 'Your lamp is lit.',
    body: 'This is where the verses you write gather — leaning toward where your heart has been.',
  },
  altar: {
    lead: 'Your altar is gathered.',
    body: 'The prayers and senses you lay down rest here, thickening each time you return to them.',
  },
  reflections: {
    lead: 'Your ascent is ready.',
    body: 'The climb through your seasons, in your own words — higher is quieter, and more yours.',
  },
}

const NOUN: Record<UpdateSurface, { one: string; many: string }> = {
  scripture: { one: 'verse', many: 'verses' },
  altar: { one: 'prayer', many: 'prayers' },
  reflections: { one: 'reflection', many: 'reflections' },
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function SurfaceArrival({ surface }: { surface: UpdateSurface }) {
  // Captured before any effect runs, so the visit hasn't cleared either signal.
  const [arrival] = useState(() => ({
    discovery: isEmberLit(surface),
    items: peekSurfaceUpdates(surface),
  }))
  const [dismissed, setDismissed] = useState(false)

  const hasItems = arrival.items.length > 0
  const show = !dismissed && (hasItems || arrival.discovery)

  useEffect(() => {
    if (!hasItems && !arrival.discovery) return
    // Consume the updates the moment they're surfaced — next visit starts clean.
    clearSurfaceUpdates(surface)
    track('surface_arrival_shown', {
      surface,
      kind: hasItems ? 'updates' : 'discovery',
      count: arrival.items.length,
    })
    // Capture is one-shot; surface identity is stable for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!show) return null

  let lead: string
  let body: string
  if (hasItems) {
    const noun = NOUN[surface]
    const n = arrival.items.length
    const named = humanList(arrival.items.slice(0, 4).map((i) => i.label))
    const extra = n - Math.min(4, n)
    lead = n === 1 ? `One new ${noun.one} since you last looked.` : `${n} new ${noun.many} since you last looked.`
    body = extra > 0 ? `${named}, and ${extra} more.` : named
  } else {
    lead = DISCOVERY_COPY[surface].lead
    body = DISCOVERY_COPY[surface].body
  }

  return (
    <div className="surface-arrival" role="status" data-kind={hasItems ? 'updates' : 'discovery'}>
      <span className="surface-arrival__dot" aria-hidden />
      <p className="surface-arrival__text">
        <span className="surface-arrival__lead">{lead}</span>{' '}
        <span className="surface-arrival__body">{body}</span>
      </p>
      <button
        type="button"
        className="surface-arrival__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
