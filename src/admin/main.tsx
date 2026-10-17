import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/alegreya'
import '@fontsource/alegreya-sc/500.css'
import '../styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './AdminApp'

/** Administration dashboard (D-275): its own small React tree, no app store or database. */
const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
