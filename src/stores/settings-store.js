import { create } from 'zustand'

const defaults = {
  theme: 'sepia',
  fontSize: 20,
  lineHeight: 1.9,
  fontFamily: 'Georgia',
  apiKey: '',
}

export const useSettingsStore = create((set, get) => ({
  ...defaults,
  loaded: false,

  loadSettings: async () => {
    const saved = await window.electronAPI.storeGet('settings')
    if (saved) set({ ...saved, loaded: true })
    else set({ loaded: true })
  },

  updateSetting: async (key, value) => {
    set({ [key]: value })
    const { theme, fontSize, lineHeight, fontFamily, apiKey } = { ...get(), [key]: value }
    await window.electronAPI.storeSet('settings', { theme, fontSize, lineHeight, fontFamily, apiKey })
  },
}))
