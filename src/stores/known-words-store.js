// Global store for words the user has marked as already known.
// These are excluded when generating hints for any book.
import { create } from 'zustand'

const load = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem('knownWords') || '[]'))
  } catch {
    return new Set()
  }
}

export const useKnownWordsStore = create((set, get) => ({
  knownWords: load(),

  markKnown: (word) => {
    const w = word.toLowerCase()
    const updated = new Set(get().knownWords)
    updated.add(w)
    try {
      localStorage.setItem('knownWords', JSON.stringify([...updated]))
    } catch (_) {}
    set({ knownWords: updated })
  },

  isKnown: (word) => get().knownWords.has(word.toLowerCase()),

  // Returns array for passing to the AI prompt
  getKnownList: () => [...get().knownWords],
}))
