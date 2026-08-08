import { useEffect, useRef } from 'react'
import { WeatherGrid } from './WeatherGrid'
import type { Facts, Weather } from './weather'

interface Props {
  weather: Weather
  facts: Facts
  /** Folded month, or null. Choosing one returns to the wall. */
  month: number | null
  onMonth: (month: number | null) => void
  onClose: () => void
  /** What the numbers are drawn over, when a subject is lit. */
  subjectLabel: string | null
}

/**
 * The density picture — off the reading path.
 *
 * This used to sit above the wall on every visit, which on a phone meant the
 * grid and four numbers took the screen and one page peeked in underneath. The
 * surface is for reading; a picture ABOUT the reading is a different errand, so
 * it gets its own frame and you go to it.
 *
 * D-017's override still holds and its limits still hold with it: with no
 * subject chosen the grid covers writing activity, and what that does NOT
 * license is totals, goals, a current streak, or any copy about not having
 * written. Empty cells stay quiet.
 */
export function WeatherPanel({
  weather,
  facts,
  month,
  onMonth,
  onClose,
  subjectLabel,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pg-weather">
      <div className="pg__inner">
        <div className="pg-weather__bar">
          <button ref={closeRef} type="button" className="pg-weather__x" onClick={onClose}>
            Back to the wall
          </button>
        </div>

        <p className="pg__eyebrow">
          {subjectLabel ? `The years — ${subjectLabel}` : 'The years'}
        </p>
        <h2 className="pg-weather__title">
          {subjectLabel ? 'Where it lives in your writing' : 'When you wrote'}
        </h2>

        <div className="pg-weather__grid">
          <WeatherGrid
            weather={weather}
            month={month}
            // Folding a month is an arrangement of the WALL, not of this panel —
            // a notebook can't put every November together and this can, so
            // choosing one takes you back to the pages it selected.
            onMonth={(m) => {
              onMonth(m)
              if (m !== null) onClose()
            }}
            noun="entry"
            nounPlural="entries"
          />
        </div>

        <div className="pg__facts pg-weather__facts">
          <Fact value={String(facts.count)} label={facts.count === 1 ? 'page' : 'pages'} />
          {facts.first ? <Fact value={facts.first} label="first" /> : null}
          {facts.latest ? <Fact value={facts.latest} label="most recent" /> : null}
          {/*
            The sharpest element here. Over passages "longest silence" is a fact;
            over writing activity it edges toward telling someone how long they
            failed to show up. Kept because the override was deliberate, and off
            the reading path now, which lowers the pressure on it — delete these
            three lines if the dry-season test ever fails.
          */}
          {facts.longestSilence >= 2 ? (
            <Fact value={`${facts.longestSilence} mo`} label="longest silence" />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="pg__fact">
      <div className="pg__fact-n">{value}</div>
      <div className="pg__fact-k">{label}</div>
    </div>
  )
}
