import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/400-italic.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
// Reflections typography: Fraunces (display) + Newsreader (the writer's words).
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/newsreader/600.css'
// Writing-font picker faces (self-hosted, no CDN): typewriter + readable.
import '@fontsource/ia-writer-duo/400.css'
import '@fontsource/ia-writer-duo/400-italic.css'
import '@fontsource/ia-writer-duo/700.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/400-italic.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './styles/global.css'
import { App } from './App'
import { initAutoUpdate } from './lib/updater'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Desktop (Tauri) only: check for and install updates in the background.
// No-ops in the browser build.
void initAutoUpdate()
