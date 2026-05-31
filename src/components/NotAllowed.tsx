import { signOut } from '@/lib/auth'

export function NotAllowed({ email }: { email: string | null }) {
  return (
    <div className="center-screen">
      <div>
        <h1 style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
          Not your journal
        </h1>
        <p style={{ color: 'var(--text-dim)' }}>
          {email ? <code>{email}</code> : 'This account'} isn’t allowed here.
        </p>
        <button className="btn" style={{ marginTop: '1rem' }} onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
