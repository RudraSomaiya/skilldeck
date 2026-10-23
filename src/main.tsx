import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <div className="app">
      <header className="bar">
        <span className="wordmark">Skilldeck</span>
      </header>
      <main className="stage">
        <p className="hint">Dealing skills from GitHub…</p>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
