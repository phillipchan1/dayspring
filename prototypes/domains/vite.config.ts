import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.PROTOTYPE_BASE || '/domains/'

export default defineConfig({
  base,
  plugins: [react()],
})
