import { create } from 'zustand'

export const useReadingStore = create((set, get) => ({
  books: [],
  currentBook: null,

  loadBooks: async () => {
    const books = await window.electronAPI.storeGet('books') || []
    set({ books })
  },

  startReading: async (title, text) => {
    const books = get().books
    const existing = books.find(b => b.title === title)
    const book = existing || { title, text, lastPosition: 0, createdAt: new Date().toISOString() }

    if (!existing) {
      book.text = text
      books.unshift(book)
      await window.electronAPI.storeSet('books', books)
    }

    set({ currentBook: book, books })
  },

  savePosition: async (position) => {
    const { currentBook, books } = get()
    if (!currentBook) return
    currentBook.lastPosition = position
    const updated = books.map(b => b.title === currentBook.title ? currentBook : b)
    set({ books: updated, currentBook: { ...currentBook } })
    await window.electronAPI.storeSet('books', updated)
  },

  goHome: () => set({ currentBook: null }),
}))
