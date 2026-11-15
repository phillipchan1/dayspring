import { Brand } from '@/components/Mark'

export function SetupNotice() {
  return (
    <div className="center-screen">
      <div style={{ maxWidth: '34rem', textAlign: 'left' }}>
        <Brand size={28} wordmarkRem={1.6} style={{ marginBottom: '0.75rem' }} />
        <p style={{ color: 'var(--text-dim)' }}>
          Almost there. Create a <code>.env.local</code> file (copy{' '}
          <code>.env.example</code>) and point the app at the Worker:
        </p>
        <pre
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1rem',
            color: 'var(--text)',
            overflowX: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
        >
{`VITE_BACKEND=workers
VITE_API_BASE_URL=http://127.0.0.1:8787`}
        </pre>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>
          Then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
