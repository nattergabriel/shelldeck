import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { TerminalProvider } from './context/terminal-context'
import { TerminalManagerProvider } from './context/terminal-manager'
import { SettingsProvider } from './context/settings-context'
import './index.css'

// Disable the default browser/WebView context menu globally.
// Our custom context menus (terminal, workspace list) call e.preventDefault() on their own.
document.addEventListener('contextmenu', (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <TerminalProvider>
        <TerminalManagerProvider>
          <App />
        </TerminalManagerProvider>
      </TerminalProvider>
    </SettingsProvider>
  </React.StrictMode>
)
