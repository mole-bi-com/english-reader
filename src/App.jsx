import { useEffect } from 'react'
import { useReadingStore } from './stores/reading-store'
import { useSettingsStore } from './stores/settings-store'
import HomeView from './components/HomeView'
import ReaderView from './components/ReaderView'

export default function App() {
  const currentBook = useReadingStore(s => s.currentBook)
  const loadBooks = useReadingStore(s => s.loadBooks)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  useEffect(() => {
    loadBooks()
    loadSettings()
  }, [])

  if (currentBook) return <ReaderView />
  return <HomeView />
}
