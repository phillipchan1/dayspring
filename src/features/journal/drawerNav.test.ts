// @vitest-environment jsdom
// The mobile drawer's history frame, and what it costs to pop it. jsdom rather
// than the default node environment because the whole point is real session
// history: pushState / replaceState / back(), with the same helpers the app uses.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_HISTORY,
  mergeAppHistory,
  pushAppHistory,
  readAppHistoryState,
  replaceAppHistory,
  type AppHistoryState,
} from '@/lib/appHistory'
import { pagesModeAction } from './drawerNav'

/**
 * The navigator, exactly as AppNavigationProvider commits: `go` pushes unless
 * told to replace, and a pop adopts whatever frame the browser hands back.
 */
function go(patch: Partial<AppHistoryState>, opts?: { replace?: boolean }) {
  const next = mergeAppHistory(readAppHistoryState() ?? DEFAULT_APP_HISTORY, patch)
  if (opts?.replace) replaceAppHistory(next)
  else pushAppHistory(next)
}

function back(): Promise<AppHistoryState | null> {
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(readAppHistoryState()), { once: true })
    history.back()
  })
}

describe('the entries drawer as a history frame', () => {
  beforeEach(() => {
    // Ascent on the canvas — where she was before opening Entries.
    replaceAppHistory(mergeAppHistory(DEFAULT_APP_HISTORY, { surface: 'reflections' }))
  })

  it('pops back to Ascent when the drawer is closed with Back — the bug', async () => {
    go({ surface: 'journal', sidebar: true }) // the Entries tab pushes the drawer
    go({ surface: 'journal', entryId: 'e1' }, { replace: true }) // tapping a row

    // Closing the drawer with `history.back()` from here does not close a
    // drawer — it discards the frame the entry was just replaced onto.
    const after = await back()
    expect(after?.surface).toBe('reflections')
    expect(after?.entryId).toBeNull()
  })

  it('keeps the entry when the drawer frame is consumed instead', async () => {
    go({ surface: 'journal', sidebar: true })
    go({ surface: 'journal', entryId: 'e1' }, { replace: true })
    go({ sidebar: false }, { replace: true }) // consumeDrawerFrame

    const open = readAppHistoryState()
    expect(open?.surface).toBe('journal')
    expect(open?.entryId).toBe('e1')
    expect(open?.sidebar).toBe(false)

    // And one frame — not two — stands between the entry and where she was.
    const after = await back()
    expect(after?.surface).toBe('reflections')
  })

  it('still leaves the drawer poppable when Back is a real dismissal', async () => {
    go({ surface: 'journal', sidebar: true })
    const after = await back()
    expect(after?.surface).toBe('reflections')
    expect(after?.sidebar).toBe(false)
  })
})

describe('pagesModeAction', () => {
  const base = {
    on: true,
    pagesActive: false,
    drawerOpen: false,
    surfaceEntryOpenedFrom: null,
  } as const

  it('pushes the wall from the desktop panel', () => {
    const action = pagesModeAction(base)
    expect(action).toMatchObject({ kind: 'go', replace: false })
    expect(action.kind === 'go' && action.patch.surface).toBe('pages')
  })

  it('consumes the drawer frame when the wall is chosen on mobile', () => {
    const action = pagesModeAction({ ...base, drawerOpen: true })
    expect(action).toMatchObject({ kind: 'go', replace: true })
    expect(action.kind === 'go' && action.patch.sidebar).toBe(false)
  })

  it('pops back off the wall on desktop', () => {
    expect(pagesModeAction({ ...base, on: false, pagesActive: true })).toEqual({ kind: 'pop' })
  })

  it('never pops off the wall from the drawer — its frame is the one on top', () => {
    // A pop here would close the drawer and leave her standing on the wall she
    // just asked to leave.
    const action = pagesModeAction({ ...base, on: false, pagesActive: true, drawerOpen: true })
    expect(action).toMatchObject({ kind: 'go', replace: true })
    expect(action.kind === 'go' && action.patch.surface).toBe('journal')
    expect(action.kind === 'go' && action.patch.sidebar).toBe(false)
  })

  it('returns to the wall an entry was opened from', () => {
    expect(
      pagesModeAction({ ...base, on: false, surfaceEntryOpenedFrom: 'pages' }),
    ).toEqual({ kind: 'return-to-origin' })
  })

  it('drops the ← Pages breadcrumb when List is chosen from the drawer', () => {
    const action = pagesModeAction({
      ...base,
      on: false,
      surfaceEntryOpenedFrom: 'pages',
      drawerOpen: true,
    })
    expect(action.kind === 'go' && action.patch.entryReturn).toBeNull()
  })

  it('does nothing when the mode tapped is the mode already showing', () => {
    expect(pagesModeAction({ ...base, on: false })).toEqual({ kind: 'none' })
    expect(pagesModeAction({ ...base, pagesActive: true })).toEqual({ kind: 'none' })
  })

  it('closes the drawer when the wall it is covering is re-chosen', () => {
    expect(pagesModeAction({ ...base, pagesActive: true, drawerOpen: true })).toEqual({
      kind: 'go',
      patch: { sidebar: false },
      replace: true,
    })
  })
})
