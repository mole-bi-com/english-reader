import { create } from 'zustand'

export const useVocabStore = create((set, get) => ({
  vocab: [],

  loadVocab: async () => {
    try {
      const res = await fetch('/api/vocab')
      if (res.ok) {
        const vocab = await res.json()
        set({ vocab })
      } else {
        // Fallback to localStorage if API fails or for offline
        const data = localStorage.getItem('vocab')
        if (data) set({ vocab: JSON.parse(data) })
      }
    } catch (err) {
      const data = localStorage.getItem('vocab')
      if (data) set({ vocab: JSON.parse(data) })
    }
  },

  saveWord: async (entry) => {
    const vocab = get().vocab
    const exists = vocab.find(v => v.word === entry.word && v.context_sentence === entry.context_sentence)
    if (exists) return
    const newEntry = { ...entry, created_at: new Date().toISOString(), is_starred: false }
    const updated = [newEntry, ...vocab]
    set({ vocab: updated })

    // Sync to API
    try {
      await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
    } catch (err) {
      console.error('Failed to sync vocab to API', err)
    }

    localStorage.setItem('vocab', JSON.stringify(updated))
  },

  removeWord: async (word, context_sentence) => {
    const updated = get().vocab.filter(v => !(v.word === word && v.context_sentence === context_sentence))
    set({ vocab: updated })

    try {
      await fetch(`/api/vocab?word=${encodeURIComponent(word)}&context_sentence=${encodeURIComponent(context_sentence)}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Failed to delete vocab from API', err)
    }

    localStorage.setItem('vocab', JSON.stringify(updated))
  },

  toggleStar: async (word, context_sentence) => {
    const item = get().vocab.find(v => v.word === word && v.context_sentence === context_sentence)
    if (!item) return

    const newStarred = !item.is_starred
    const updated = get().vocab.map(v =>
      v.word === word && v.context_sentence === context_sentence
        ? { ...v, is_starred: newStarred }
        : v
    )
    set({ vocab: updated })

    try {
      await fetch('/api/vocab', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, context_sentence, is_starred: newStarred }),
      })
    } catch (err) {
      console.error('Failed to toggle star in API', err)
    }

    localStorage.setItem('vocab', JSON.stringify(updated))
  },

  isWordSaved: (word) => get().vocab.some(v => v.word === word.toLowerCase()),
}))
