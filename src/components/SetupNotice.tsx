export function SetupNotice() {
  return (
    <div className="center-screen">
      <div style={{ maxWidth: '34rem', textAlign: 'left' }}>
        <h1 style={{ color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>
          Dayspring
        </h1>
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
VITE_SUPABASE_ANON_KEY=...
VITE_ALLOWED_EMAIL=phillipchan1@gmail.com`}
        </pre>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>
          Then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
