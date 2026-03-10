import { create } from 'zustand'
import { generateHintsWithGemini } from '../services/hints'
import { useSettingsStore } from './settings-store'
import { useKnownWordsStore } from './known-words-store'
import { useVocabStore } from './vocab-store'

export const useReadingStore = create((set, get) => ({
  books: [],
  currentBook: null,

  loadBooks: async () => {
    try {
      const res = await fetch('/api/books')
      if (res.ok) {
        const books = await res.json()
        set({ books: books.map(b => ({ ...b, hints: b.hints || {}, hintStatus: Object.keys(b.hints || {}).length > 0 ? 'ready' : 'idle' })) })
      } else {
        const data = localStorage.getItem('books')
        if (data) set({ books: JSON.parse(data).map(b => ({ ...b, hints: b.hints || {}, hintStatus: Object.keys(b.hints || {}).length > 0 ? 'ready' : 'idle' })) })
      }
    } catch (err) {
      const data = localStorage.getItem('books')
      if (data) set({ books: JSON.parse(data).map(b => ({ ...b, hints: b.hints || {}, hintStatus: Object.keys(b.hints || {}).length > 0 ? 'ready' : 'idle' })) })
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

    const { apiKey, hintWordCount } = useSettingsStore.getState()
    const knownWords = useKnownWordsStore.getState().getKnownList()
    const hardWords = useVocabStore.getState().vocab.slice(0, 100).map(v => v.word)

    _setHintStatus(title, 'loading')

    try {
      const res = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: book.text, bookTitle: book.title, hintWordCount, knownWords, hardWords }),
      })

      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
        throw new Error('API unavailable')
      }

      const hints = await res.json()
      if (hints && !hints.error) {
        _applyHints(title, hints)
        return
      }
      throw new Error(hints.error ?? 'Invalid response')
    } catch {
      // Fallback: call Gemini directly from client
      if (!apiKey) {
        _setHintStatus(title, 'error')
        return
      }
      try {
        const hints = await generateHintsWithGemini(book.text, apiKey, hintWordCount, knownWords, hardWords)
        _applyHints(title, hints)
      } catch (err) {
        console.error('Hint generation failed:', err)
        _setHintStatus(title, 'error')
      }
    }
  },

  startReading: async (title, text) => {
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
