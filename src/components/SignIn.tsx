import { useState } from 'react'
import { signInWithGoogle } from '@/lib/auth'
import { Brand } from '@/components/Mark'

export function SignIn() {
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    }
  }

  return (
    <div className="center-screen">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Brand size={34} wordmarkRem={2} />
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            color: 'var(--text-dim)',
            margin: '0.6rem 0 0',
          }}
        >
          the dayspring from on high.
        </p>
        <p style={{ color: 'var(--text-dim)', margin: '1.25rem 0 1.5rem' }}>
          A private place to write.
        </p>
        <button className="btn" onClick={handleSignIn}>
          Continue with Google
        </button>
        {error && (
          <p style={{ color: 'var(--danger)', marginTop: '1rem', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
