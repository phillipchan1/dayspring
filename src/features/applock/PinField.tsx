// The one secret input, shared by the lock screen and the set-up flow so the two
// can never drift apart on the details that matter.
//
// A PIN is drawn as a row of Dayspring-gold dots that fill as digits are typed —
// the passcode screen's behaviour in the house colours. Underneath it is still a
// real text input, laid over the dots and invisible, so the system number pad,
// paste, and a hardware keyboard all work exactly as they did; the dots are only
// what it looks like.
//
// Why not `<input type="password">`: iOS ignores `inputMode` on a password
// field, so a PIN would raise the full alphabetic keyboard and the user would
// have to find the 123 key every time they open their journal. `type="text"`
// keeps the number pad; the dots (or, for a passphrase, `-webkit-text-security`)
// do the masking.
//
// `enterKeyHint="go"` matters more than it looks: with the keyboard up on a
// phone the button can sit behind it, so the return key has to be a complete
// way to submit on its own.
//
// Busy is `readOnly`, never `disabled`: disabling a focused field on iOS drops
// the keyboard, and it would bounce down and back up on every attempt.

import { useEffect, useRef, useState } from 'react'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, type AppLockKind } from '@/lib/appLock'

/**
 * How many dots to draw. The PIN's own length when it is known (the lock can
 * open on the last one); otherwise four to start, one more for each digit past
 * that, which is how a new 4–8 digit PIN is chosen.
 */
export function pinSlots(typed: number, length?: number | null): number {
  if (length) return length
  return Math.min(PIN_MAX_LENGTH, Math.max(PIN_MIN_LENGTH, typed))
}

export function PinField({
  kind,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  placeholder,
  length,
  shake = 0,
  'aria-label': ariaLabel,
}: {
  kind: AppLockKind
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  /** The PIN's length when known: that many dots, and no typing past it. */
  length?: number | null
  /** Bump to shake the field — a wrong PIN. */
  shake?: number
  'aria-label': string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [shaking, setShaking] = useState(false)

  // Focus on mount and whenever the field is re-armed for another try, so a
  // wrong PIN doesn't leave the user tapping to get the keyboard back.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus()
  }, [autoFocus, disabled])

  // A damped shake, restarted for each wrong attempt. Under Reduce Motion the
  // animation never runs; the error line under the field still says it.
  useEffect(() => {
    if (!shake) return
    setShaking(false)
    const id = requestAnimationFrame(() => setShaking(true))
    return () => cancelAnimationFrame(id)
  }, [shake])

  const isPin = kind === 'pin'
  const max = isPin ? (length ?? PIN_MAX_LENGTH) : undefined

  const input = (
    <input
      ref={ref}
      type="text"
      className={isPin ? 'pin-field__input' : 'pin-field__text'}
      value={value}
      readOnly={disabled}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      placeholder={isPin ? undefined : placeholder}
      inputMode={isPin ? 'numeric' : 'text'}
      enterKeyHint="go"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      maxLength={max}
      onChange={(e) => {
        if (disabled) return
        // Strip non-digits on the way in rather than rejecting after the fact,
        // so a stray keystroke on a desktop keyboard is simply ignored.
        const next = isPin ? e.target.value.replace(/\D/g, '').slice(0, max) : e.target.value
        onChange(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (!disabled) onSubmit()
        }
      }}
    />
  )

  return (
    <div
      className="pin-field"
      data-kind={kind}
      data-shaking={shaking || undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShaking(false)
      }}
      // A tap anywhere on the dots is a tap on the field.
      onPointerDown={(e) => {
        if (e.target !== ref.current) {
          e.preventDefault()
          ref.current?.focus()
        }
      }}
    >
      {isPin && (
        <div className="pin-field__dots" aria-hidden>
          {Array.from({ length: pinSlots(value.length, length) }, (_, i) => (
            <span key={i} className="pin-field__dot" data-filled={i < value.length} />
          ))}
        </div>
      )}
      {input}
    </div>
  )
}
