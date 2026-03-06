import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeApiInterceptor } from './config/api'

// Initialize API URL interceptor before rendering
// This automatically rewrites localhost:5000 URLs to the configured VITE_API_URL
initializeApiInterceptor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
