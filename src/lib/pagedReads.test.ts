// A paged Supabase read must be ordered.
//
// `.range()` without `.order()` is LIMIT/OFFSET over an unordered relation, and
// Postgres guarantees nothing about the order of an unordered relation between
// two queries. Rows come back on two pages, and — the half that is dangerous,
// because nothing announces it — other rows never come back at all.
//
// Every reader in the app already followed this rule. It was broken by three
// files added in one afternoon, and it surfaced only because a unique index
// happened to reject the duplicate half: 5,420 of 10,336 join rows. Had the
// index not existed, the missing rows would have been invisible, in a backfill
// that reported success over them.
//
// So it is a convention worth enforcing rather than remembering.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src', 'api', 'scripts']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(path, out)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

/**
 * CodeMirror's `Decoration.range(from, to)` shares the name and is unrelated.
 * A Supabase page is `.range(<from>, <from> + …)` over a numeric window, and
 * every one in this codebase is written across lines with the call last.
 */
const SUPABASE_RANGE = /\.range\(\s*(\w+)\s*,\s*\1\s*\+/

describe('paged Supabase reads', () => {
  const offenders: string[] = []

  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!SUPABASE_RANGE.test(line)) return
        // A query builder is a chain and the ordering may be applied on either
        // side of the range — appended afterwards as a tiebreaker, or set
        // before. Look both ways.
        const window = lines.slice(Math.max(0, i - 10), i + 8).join('\n')
        if (!window.includes('.order(')) offenders.push(`${file}:${i + 1}`)
      })
    }
  }

  it('always order, so no row is served twice and none is skipped', () => {
    expect(offenders).toEqual([])
  })
})
