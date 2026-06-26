import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import AppWithDashboards from './AppWithDashboards.tsx'
import { DashboardShellProvider } from './context/DashboardShellContext.tsx'
import { OperationsFeedProvider } from './context/OperationsFeedContext.tsx'
import { SelectionProvider } from './context/SelectionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DashboardShellProvider>
      <OperationsFeedProvider>
        <SelectionProvider>
          <AppWithDashboards />
        </SelectionProvider>
      </OperationsFeedProvider>
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'bg-surface-2 border border-slate-600 text-slate-100',
          },
        }}
      />
    </DashboardShellProvider>
  </StrictMode>,
)
