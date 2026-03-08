import { create } from 'zustand'

export const useReadingStore = create((set, get) => ({
  books: [],
  currentBook: null,

  loadBooks: async () => {
    try {
      const res = await fetch('/api/books')
      if (res.ok) {
        const books = await res.json()
        set({ books: books.map(b => ({ ...b, hints: b.hints || {} })) })
      } else {
        const data = localStorage.getItem('books')
        if (data) set({ books: JSON.parse(data).map(b => ({ ...b, hints: b.hints || {} })) })
      }
    } catch (err) {
      const data = localStorage.getItem('books')
      if (data) set({ books: JSON.parse(data).map(b => ({ ...b, hints: b.hints || {} })) })
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
      hints: {}
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

    // Trigger AI analysis if hints are missing
    if (!book.hints || Object.keys(book.hints).length === 0) {
      fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: book.text, bookTitle: book.title }),
      })
        .then(res => res.json())
        .then(hints => {
          if (hints && !hints.error) {
            set(state => ({
              books: state.books.map(b => b.title === title ? { ...b, hints } : b),
              currentBook: get().currentBook?.title === title ? { ...get().currentBook, hints } : get().currentBook
            }))
          }
        })
        .catch(console.error)
    }

    set({ currentBook: book, books })
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
