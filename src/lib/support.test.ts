import { describe, expect, it } from 'vitest'
import {
  HELP_CONTACT_URL,
  HELP_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  SUPPORT_EMAIL,
} from './support'

describe('support links', () => {
  it('points help and contact at the marketing site', () => {
    expect(HELP_URL).toBe('https://www.usedayspring.app/help')
    expect(HELP_CONTACT_URL).toBe('https://www.usedayspring.app/help/contact')
    expect(SUPPORT_EMAIL).toBe('hello@usedayspring.app')
  })

  it('points Instagram at the public account', () => {
    expect(INSTAGRAM_URL).toBe('https://www.instagram.com/dayspringjournal/')
    expect(INSTAGRAM_HANDLE).toBe('@dayspringjournal')
  })
})
