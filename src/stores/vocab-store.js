import { create } from 'zustand'

export const useVocabStore = create((set, get) => ({
  vocab: [],

  loadVocab: async () => {
    const vocab = await window.electronAPI.storeGet('vocab') || []
    set({ vocab })
  },

  saveWord: async (entry) => {
    const vocab = get().vocab
    const exists = vocab.find(v => v.word === entry.word && v.context_sentence === entry.context_sentence)
    if (exists) return
    const newEntry = { ...entry, created_at: new Date().toISOString(), is_starred: false }
    const updated = [newEntry, ...vocab]
    set({ vocab: updated })
    await window.electronAPI.storeSet('vocab', updated)
  },

  removeWord: async (word, context_sentence) => {
    const updated = get().vocab.filter(v => !(v.word === word && v.context_sentence === context_sentence))
    set({ vocab: updated })
    await window.electronAPI.storeSet('vocab', updated)
  },

  isWordSaved: (word) => get().vocab.some(v => v.word === word.toLowerCase()),
}))
