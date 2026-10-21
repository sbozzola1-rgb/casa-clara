import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { leaveRoutine } from './routine/door.ts'
import RoutineApp from './routine/RoutineApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoutineApp onLeave={leaveRoutine} />
  </StrictMode>,
)
