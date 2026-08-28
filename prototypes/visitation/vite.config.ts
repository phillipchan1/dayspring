import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.PROTOTYPE_BASE || '/visitation/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5190 },
})
