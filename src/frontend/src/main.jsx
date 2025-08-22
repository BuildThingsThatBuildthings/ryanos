import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { validateSupabaseConfig } from './utils/supabase-test'

// Validate Supabase configuration in development
if (import.meta.env.DEV) {
  const { isValid, errors } = validateSupabaseConfig();
  if (!isValid) {
    console.warn('Supabase configuration issues:', errors);
    console.warn('Please set up your .env file with proper Supabase credentials');
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
