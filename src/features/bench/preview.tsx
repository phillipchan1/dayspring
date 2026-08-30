// Mounts the sandbox with no auth, no Supabase and no JournalScreen — the same
// trick `?__preview=pages` uses, and for the same reason: an internal page
// should not have to be reached through a login.
//
// Dev-only. `main.tsx` guards the whole block with `import.meta.env.DEV`, which
// Vite evaluates statically, so this module and the corpus it pulls in never
// enter a production bundle.

import { createRoot } from 'react-dom/client'
import { DemoPage } from './DemoPage'
import '@/styles/global.css'

export function renderNoticingPreview(): void {
  const root = document.getElementById('root')
  if (!root) return
  createRoot(root).render(<DemoPage />)
}
