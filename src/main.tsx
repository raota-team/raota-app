import React from 'react'
import ReactDOM from 'react-dom/client'
import { DEFAULT_LOCALE, getIntlLocale, getLocale, resolveLocale, setLocale, subscribeLocale } from '@raota/shared'
import 'leaflet/dist/leaflet.css'
import App from './App'
import './index.css'

function syncBrowserLocale() {
  setLocale(resolveLocale(navigator.languages?.length ? navigator.languages : [navigator.language]))
  document.documentElement.lang = getIntlLocale()
}
syncBrowserLocale()
window.addEventListener('languagechange', syncBrowserLocale)
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('languagechange', syncBrowserLocale))

function LocalizedApp() {
  React.useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE)
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocalizedApp />
  </React.StrictMode>,
)
