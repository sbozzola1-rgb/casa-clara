import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RoutineApp from './routine/RoutineApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoutineApp />
  </StrictMode>,
)
