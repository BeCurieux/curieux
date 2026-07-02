import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initAppBridge } from './lib/appbridge.js'
import './styles.css'

// Boot App Bridge when embedded in Shopify admin (no-op standalone).
initAppBridge()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
