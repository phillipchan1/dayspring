import { Brand } from '@/components/Mark'

export function SetupNotice() {
  return (
    <div className="center-screen">
      <div style={{ maxWidth: '34rem', textAlign: 'left' }}>
        <Brand size={28} wordmarkRem={1.6} style={{ marginBottom: '0.75rem' }} />
        <p style={{ color: 'var(--text-dim)' }}>
          Almost there. Create a <code>.env.local</code> file (copy{' '}
          <code>.env.example</code>) and add your Supabase keys:
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
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
        </pre>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>
          Then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
