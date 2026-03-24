import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initFirebase } from './services/firebase'
import './index.css'
import App from './App.tsx'

initFirebase()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
