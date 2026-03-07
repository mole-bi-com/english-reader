import { useEffect } from 'react'
import { useReadingStore } from './stores/reading-store'
import { useSettingsStore } from './stores/settings-store'
import HomeView from './components/HomeView'

export default function App() {
  const currentBook = useReadingStore(s => s.currentBook)
  const loadBooks = useReadingStore(s => s.loadBooks)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  useEffect(() => {
    loadBooks()
    loadSettings()
  }, [])

  if (currentBook) return <div className="app">Reader coming soon...</div>
  return <HomeView />
}
