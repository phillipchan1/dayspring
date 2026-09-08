import { createRoot } from 'react-dom/client'
import { SignIn } from './SignIn'

/** Dev-only: `?__preview=signin` — the login surface without a Supabase session. */
export function renderSignInPreview() {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root not found')
  createRoot(root).render(<SignIn />)
}
