// The one masked input, shared by the lock screen and the set-up flow so the two
// can never drift apart on the details that matter.
//
// Why not `<input type="password">`: iOS ignores `inputMode` on a password
// field, so a PIN would raise the full alphabetic keyboard and the user would
// have to find the 123 key every time they open their journal. `type="text"`
// with `-webkit-text-security` masks the value and keeps the number pad — and
// every surface Dayspring ships to is WebKit or Chromium, so the property is
// supported everywhere it needs to be.
//
// `enterKeyHint="go"` matters more than it looks: with the keyboard up on a
// phone the Open button can sit behind it, so the return key has to be a
// complete way to submit on its own.

import { useEffect, useRef } from 'react'
import { PIN_MAX_LENGTH, type AppLockKind } from '@/lib/appLock'

export function PinField({
  kind,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  placeholder,
  'aria-label': ariaLabel,
}: {
  kind: AppLockKind
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  'aria-label': string
}) {
  const ref = useRef<HTMLInputElement>(null)

  // Focus on mount and whenever the field is re-armed for another try, so a
  // wrong PIN doesn't leave the user tapping to get the keyboard back.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus()
  }, [autoFocus, disabled])

  const isPin = kind === 'pin'

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      inputMode={isPin ? 'numeric' : 'text'}
      enterKeyHint="go"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      maxLength={isPin ? PIN_MAX_LENGTH : undefined}
      onChange={(e) => {
        // Strip non-digits on the way in rather than rejecting after the fact,
        // so a stray keystroke on a desktop keyboard is simply ignored.
        const next = isPin ? e.target.value.replace(/\D/g, '') : e.target.value
        onChange(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onSubmit()
        }
      }}
      style={{
        width: '100%',
        maxWidth: isPin ? 200 : 260,
        padding: '12px 16px',
        borderRadius: 7,
        background: 'color-mix(in srgb, var(--text-bright) 4%, transparent)',
        border: '0.5px solid var(--border)',
        color: 'var(--text-bright)',
        fontFamily: isPin ? 'var(--font-mono)' : "'Inter', -apple-system, sans-serif",
        fontSize: isPin ? 20 : 15,
        textAlign: 'center',
        letterSpacing: isPin ? '0.4em' : 'normal',
        // Trailing letter-spacing on a centred field pushes the glyphs left of
        // centre; the indent puts them back.
        textIndent: isPin ? '0.4em' : 0,
        WebkitTextSecurity: 'disc',
        outline: 'none',
      } as React.CSSProperties}
    />
  )
}
