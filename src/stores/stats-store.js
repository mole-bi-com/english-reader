import { create } from 'zustand'

export const useStatsStore = create((set, get) => ({
    dailyStats: [],
    loading: false,

    fetchStats: async () => {
        set({ loading: true })
        try {
            const res = await fetch('/api/stats')
            if (res.ok) {
                const data = await res.json()
                set({ dailyStats: data })
            }
        } catch (err) {
            console.error('Failed to fetch stats', err)
        } finally {
            set({ loading: false })
        }
    },

    addReadActivity: async (words, minutes) => {
        try {
            const res = await fetch('/api/stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordsToAdd: words, minutesToAdd: minutes }),
            })
            if (res.ok) {
                const updated = await res.json()
                const currentStats = get().dailyStats
                const index = currentStats.findIndex(s => s.read_date.startsWith(new Date().toISOString().split('T')[0]))

                if (index > -1) {
                    const newStats = [...currentStats]
                    newStats[index] = updated
                    set({ dailyStats: newStats })
                } else {
                    set({ dailyStats: [updated, ...currentStats] })
                }
            }
        } catch (err) {
            console.error('Failed to add activity', err)
        }
    }
}))
