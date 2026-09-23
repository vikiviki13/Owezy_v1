import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startInstallCapture } from './lib/install.ts'

startInstallCapture()

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hide the boot splash only once React has actually mounted, so there is never
// a blank frame between the splash and the first painted screen.
function dismissBootSplash() {
  const boot = document.getElementById('boot-splash')
  if (!boot) return
  if (!document.getElementById('root')?.firstChild) {
    requestAnimationFrame(dismissBootSplash)
    return
  }
  boot.classList.add('is-hiding')
  window.setTimeout(() => {
    boot.remove()
    try { sessionStorage.removeItem('tab_boot_mode') } catch { /* ignore */ }
  }, 450)
}
requestAnimationFrame(dismissBootSplash)
