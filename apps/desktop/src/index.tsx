import { render } from 'solid-js/web'
import { ErrorBoundary } from 'solid-js'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')

render(
    () => (
        <ErrorBoundary fallback={(err) => <div class="notice error">Critical App Error: {String(err)}</div>}>
            <App />
        </ErrorBoundary>
    ),
    root!
)
