import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.PROTOTYPE_BASE || '/looking/'

export default defineConfig({
  base,
  plugins: [react()],
})
