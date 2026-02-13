import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import API_BASE from './config/api'

// In production, the backend requires a per-run token to prevent untrusted local processes
// from calling privileged endpoints. Patch fetch so all API calls include the token.
const apiToken = globalThis?.lyricvault?.apiToken
if (apiToken) {
  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url
    if (typeof url === 'string' && url.startsWith(API_BASE)) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
      headers.set('X-LyricVault-Token', apiToken)
      const req = input instanceof Request ? new Request(input, { ...init, headers }) : input
      return originalFetch(req, input instanceof Request ? undefined : { ...init, headers })
    }
    return originalFetch(input, init)
  }
}

// Replace polling with a single SSE connection that broadcasts backend state changes.
if (apiToken) {
  const es = new EventSource(`${API_BASE}/events`)

  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent('lyricvault:event', { detail: msg }))
    } catch {
      // Ignore malformed payloads.
    }
  }

  es.onerror = () => {
    // EventSource auto-reconnects; no-op.
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
