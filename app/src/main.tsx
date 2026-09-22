import React from 'react'
import ReactDOM from 'react-dom/client'
import { ensureSchemaVersion } from './lib/db'
import { seedAll } from './lib/seed'
import App from './App'
import './index.css'

ensureSchemaVersion(seedAll)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
