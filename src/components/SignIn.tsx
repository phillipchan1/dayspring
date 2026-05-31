import { useState } from 'react'
import { signInWithGoogle } from '@/lib/auth'

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
      <div>
        <h1
          style={{
            color: 'var(--text-bright)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          Dayspring
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
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
