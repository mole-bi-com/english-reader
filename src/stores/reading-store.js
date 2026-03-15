import { create } from 'zustand'
import { generateHintsWithGemini } from '../services/hints'
import { useSettingsStore } from './settings-store'
import { useKnownWordsStore } from './known-words-store'
import { useVocabStore } from './vocab-store'

// Track Gemini API token usage in localStorage
export function trackTokenUsage(usage) {
  try {
    const stored = JSON.parse(localStorage.getItem('tokenUsage') || '{"input":0,"output":0,"calls":0}')
    stored.input += usage.input || 0
    stored.output += usage.output || 0
    stored.calls += 1
    localStorage.setItem('tokenUsage', JSON.stringify(stored))
  } catch { /* ignore */ }
}

export function getTokenUsage() {
  try {
    return JSON.parse(localStorage.getItem('tokenUsage') || '{"input":0,"output":0,"calls":0}')
  } catch {
    return { input: 0, output: 0, calls: 0 }
  }
}

export const useReadingStore = create((set, get) => ({
  books: [],
  currentBook: null,

  // Session tracking
  sessionLookups: [],
  sessionStart: null,

  startSession: () => {
    set({ sessionLookups: [], sessionStart: new Date().toISOString() })
  },

  recordLookup: (word) => {
    const { sessionLookups } = get()
    if (!sessionLookups.includes(word)) {
      set({ sessionLookups: [...sessionLookups, word] })
    }
  },

  getSessionMinutes: () => {
    const { sessionStart } = get()
    if (!sessionStart) return 0
    return Math.round((new Date() - new Date(sessionStart)) / 60000)
  },

  loadBooks: async () => {
    const toBook = (b, localHintsMap = {}) => {
      const hints = (b.hints && Object.keys(b.hints).length > 0) ? b.hints : (localHintsMap[b.title] || {})
      return { ...b, hints, hintStatus: Object.keys(hints).length > 0 ? 'ready' : 'idle' }
    }
    try {
      const res = await fetch('/api/books')
      if (res.ok) {
        const dbBooks = await res.json()
        // Merge hints from localStorage as fallback (for existing books before DB migration)
        const localData = localStorage.getItem('books')
        const localHintsMap = localData
          ? Object.fromEntries(JSON.parse(localData).map(b => [b.title, b.hints || {}]))
          : {}
        const books = dbBooks.map(b => toBook(b, localHintsMap))
        set({ books })
        localStorage.setItem('books', JSON.stringify(books))
      } else {
        const data = localStorage.getItem('books')
        if (data) set({ books: JSON.parse(data).map(b => toBook(b)) })
      }
    } catch (err) {
      const data = localStorage.getItem('books')
      if (data) set({ books: JSON.parse(data).map(b => toBook(b)) })
    }
  },

  deleteBook: async (title) => {
    const { books, currentBook } = get()
    const updated = books.filter(b => b.title !== title)
    set({ books: updated, currentBook: currentBook?.title === title ? null : currentBook })
    localStorage.setItem('books', JSON.stringify(updated))
    try {
      await fetch('/api/books', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    } catch (err) {
      console.error('Failed to delete book from API', err)
    }
  },

  // Set hint status for a book and update currentBook if it matches
  _setHintStatus: (title, status) => {
    set(state => ({
      books: state.books.map(b => b.title === title ? { ...b, hintStatus: status } : b),
      currentBook: state.currentBook?.title === title
        ? { ...state.currentBook, hintStatus: status }
        : state.currentBook,
    }))
  },

  // Apply generated hints to a book
  _applyHints: (title, hints) => {
    set(state => ({
      books: state.books.map(b => b.title === title ? { ...b, hints, hintStatus: 'ready' } : b),
      currentBook: state.currentBook?.title === title
        ? { ...state.currentBook, hints, hintStatus: 'ready' }
        : state.currentBook,
    }))
    // Persist to localStorage
    const { books } = get()
    localStorage.setItem('books', JSON.stringify(books))
  },

  // Generate hints on demand — called when user toggles Hints On or retries
  generateHints: async (title) => {
    const { books, currentBook, _setHintStatus, _applyHints } = get()
    const book = books.find(b => b.title === title) ?? currentBook
    if (!book) return

    const { apiKey } = useSettingsStore.getState()
    const knownWords = useKnownWordsStore.getState().getKnownList()

    // Deduplicate by word (most recent first, as vocab is stored newest-first)
    const vocabItems = useVocabStore.getState().vocab
    const seenWords = new Set()
    const hardWords = vocabItems
      .filter(v => {
        const key = v.word.toLowerCase()
        if (seenWords.has(key)) return false
        seenWords.add(key)
        return true
      })
      .slice(0, 150)
      .map(v => {
        let entry = v.word
        if (v.pos) entry += ` (${v.pos})`
        if (v.en_definition) entry += `: ${v.en_definition}`
        else if (v.ko) entry += `: ${v.ko}`
        return entry
      })

    _setHintStatus(title, 'loading')

    try {
      const res = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: book.text, bookTitle: book.title, knownWords, hardWords }),
      })

      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
        throw new Error('API unavailable')
      }

      const data = await res.json()
      if (data && data.hints && !data.error) {
        _applyHints(title, data.hints)
        if (data.usage) trackTokenUsage(data.usage)
        return
      }
      throw new Error(data.error ?? 'Invalid response')
    } catch {
      // Fallback: call Gemini directly from client
      if (!apiKey) {
        _setHintStatus(title, 'error')
        return
      }
      try {
        const hints = await generateHintsWithGemini(book.text, apiKey, knownWords, hardWords)
        _applyHints(title, hints)
      } catch (err) {
        console.error('Hint generation failed:', err)
        _setHintStatus(title, 'error')
      }
    }
  },

  startReading: async (title, text) => {
    get().startSession()
    const books = get().books
    const existing = books.find(b => b.title === title)
    const book = existing || {
      title,
      text,
      last_position: 0,
      created_at: new Date().toISOString(),
      hints: {},
      hintStatus: 'idle',
    }

    if (!existing) {
      books.unshift(book)
      try {
        await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, text }),
        })
      } catch (err) {
        console.error('Failed to sync book to API', err)
      }
      localStorage.setItem('books', JSON.stringify(books))
    }

    set({ currentBook: { ...book }, books })

    // Auto-generate hints if none exist yet
    if (!book.hints || Object.keys(book.hints).length === 0) {
      get().generateHints(title)
    }
  },

  savePosition: async (position) => {
    const { currentBook, books } = get()
    if (!currentBook) return
    currentBook.last_position = position
    const updated = books.map(b => b.title === currentBook.title ? currentBook : b)
    set({ books: updated, currentBook: { ...currentBook } })

    try {
      await fetch('/api/books', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentBook.title, lastPosition: position }),
      })
    } catch (err) {
      console.error('Failed to sync position to API', err)
    }

    localStorage.setItem('books', JSON.stringify(updated))
  },

  goHome: () => set({ currentBook: null }),
}))
