import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { feedbackDevPlugin } from '../_shared/vite/feedbackDevPlugin.ts'

const base = process.env.PROTOTYPE_BASE || '/scripture/'

const SCRIPTURE_LABELS = {
  A: 'A — link out to ESV.org',
  B: 'B — chapter beside the journal',
  C: 'C',
  other: 'Something else',
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['RESEND_API_KEY', 'FEEDBACK_TO', 'FEEDBACK_FROM'] as const) {
    if (env[key]) process.env[key] = env[key]
  }
  return {
    base,
    plugins: [react(), feedbackDevPlugin(SCRIPTURE_LABELS)],
  }
})
