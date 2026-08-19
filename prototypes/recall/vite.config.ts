import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.PROTOTYPE_BASE || '/recall/'

export default defineConfig({
  base,
  plugins: [react()],
})
