import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithDashboards from './AppWithDashboards.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithDashboards />
  </StrictMode>,
)
