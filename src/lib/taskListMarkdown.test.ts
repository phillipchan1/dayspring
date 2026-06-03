import { describe, expect, it } from 'vitest'
import {
  isTaskLine,
  normalizeTaskLineForDisplay,
  parseTaskLine,
  taskBodyStart,
  taskMarkerRange,
  toggledMarker,
  uncheckedTaskPrefix,
} from './taskListMarkdown'

describe('parseTaskLine', () => {
  it('parses a bare unchecked task', () => {
    expect(parseTaskLine('[] buy milk')).toMatchObject({
      indent: '',
      bullet: '',
      checked: false,
      body: 'buy milk',
    })
  })

  it('parses bulleted and checked variants', () => {
    expect(parseTaskLine('- [ ] todo')).toMatchObject({ bullet: '- ', checked: false, body: 'todo' })
    expect(parseTaskLine('- [x] done')).toMatchObject({ bullet: '- ', checked: true, body: 'done' })
    expect(parseTaskLine('* [X] done')).toMatchObject({ checked: true })
  })

  it('preserves leading indentation', () => {
    expect(parseTaskLine('    [] nested')).toMatchObject({ indent: '    ', body: 'nested' })
  })

  it('returns null for non-task lines', () => {
    expect(parseTaskLine('just text')).toBeNull()
    expect(parseTaskLine('[notabox]')).toBeNull()
    expect(isTaskLine('# heading')).toBe(false)
  })
})

describe('marker geometry', () => {
  it('locates the marker range and body start', () => {
    const line = '- [ ] task'
    const range = taskMarkerRange(line)!
    expect(line.slice(range.from, range.to)).toBe('[ ]')
    expect(line.slice(taskBodyStart(line))).toBe('task')
  })
})

describe('toggle + continuation', () => {
  it('toggles markers in both directions', () => {
    expect(toggledMarker(parseTaskLine('[] a')!)).toBe('[x]')
    expect(toggledMarker(parseTaskLine('[x] a')!)).toBe('[]')
    expect(toggledMarker(parseTaskLine('- [x] a')!)).toBe('[ ]')
  })

  it('builds an unchecked continuation prefix', () => {
    expect(uncheckedTaskPrefix(parseTaskLine('- [x] a')!)).toBe('- [ ] ')
    expect(uncheckedTaskPrefix(parseTaskLine('[x] a')!)).toBe('[] ')
  })
})

describe('normalizeTaskLineForDisplay', () => {
  it('produces GFM checkboxes for rendering', () => {
    expect(normalizeTaskLineForDisplay('[] a')).toBe('- [ ] a')
    expect(normalizeTaskLineForDisplay('[x] a')).toBe('- [x] a')
    expect(normalizeTaskLineForDisplay('- [ ] a')).toBe('- [ ] a')
  })
  it('passes through non-task lines', () => {
    expect(normalizeTaskLineForDisplay('plain')).toBe('plain')
  })
})
