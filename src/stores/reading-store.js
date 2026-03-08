import { create } from 'zustand'

export const useReadingStore = create((set, get) => ({
  books: [],
  currentBook: null,

  loadBooks: async () => {
    try {
      const res = await fetch('/api/books')
      if (res.ok) {
        const books = await res.json()
        set({ books })
      } else {
        const data = localStorage.getItem('books')
        if (data) set({ books: JSON.parse(data) })
      }
    } catch (err) {
      const data = localStorage.getItem('books')
      if (data) set({ books: JSON.parse(data) })
    }
  },

  startReading: async (title, text) => {
    const books = get().books
    const existing = books.find(b => b.title === title)
    const book = existing || { title, text, last_position: 0, created_at: new Date().toISOString() }

    if (!existing) {
      book.text = text
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
