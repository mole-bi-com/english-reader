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
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const saved = await res.json()
        if (saved && saved.id) {
          // Map DB snake_case to CamelCase if needed, but here we used theme, font_size etc in DB
          set({
            theme: saved.theme || defaults.theme,
            fontSize: saved.font_size || defaults.fontSize,
            lineHeight: saved.line_height || defaults.lineHeight,
            fontFamily: saved.font_family || defaults.fontFamily,
            apiKey: saved.api_key || defaults.apiKey,
            loaded: true
          })
          return
        }
      }

      const data = localStorage.getItem('settings')
      const saved = data ? JSON.parse(data) : null
      if (saved) set({ ...saved, loaded: true })
      else set({ loaded: true })
    } catch (err) {
      const data = localStorage.getItem('settings')
      const saved = data ? JSON.parse(data) : null
      if (saved) set({ ...saved, loaded: true })
      else set({ loaded: true })
    }
  },

  updateSetting: async (key, value) => {
    const newSettings = { ...get(), [key]: value }
    set({ [key]: value })

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: newSettings.theme,
          fontSize: newSettings.fontSize,
          lineHeight: newSettings.lineHeight,
          fontFamily: newSettings.fontFamily,
          apiKey: newSettings.apiKey,
        }),
      })
    } catch (err) {
      console.error('Failed to sync settings to API', err)
    }

    localStorage.setItem('settings', JSON.stringify({
      theme: newSettings.theme,
      fontSize: newSettings.fontSize,
      lineHeight: newSettings.lineHeight,
      fontFamily: newSettings.fontFamily,
      apiKey: newSettings.apiKey
    }))
  },
}))
