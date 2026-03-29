import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initFirebase } from './services/firebase'
import { preloadAssets } from './designs/assetLoader'
import './index.css'
import App from './App.tsx'

initFirebase()
preloadAssets()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
