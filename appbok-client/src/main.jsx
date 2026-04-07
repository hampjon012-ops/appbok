import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DomainRouter from './DomainRouter.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DomainRouter />
  </StrictMode>,
)
