import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startInstallCapture } from './lib/install.ts'
import { AppUpdateProvider } from './components/AppUpdateProvider.tsx'

startInstallCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppUpdateProvider>
      <App />
    </AppUpdateProvider>
  </StrictMode>,
)
