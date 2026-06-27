import { Story, Settings } from '../types'

const FAVORITES_KEY = 'storyspark_favorites'
const SETTINGS_KEY = 'storyspark_settings'

const defaultSettings: Settings = {
  anthropicApiKey: '',
  openaiApiKey: '',
  defaultModel: 'claude-3-haiku-20240307',
  defaultLength: 'medium',
  autoImageGen: false,
  theme: 'dark',
  ttsRate: 1.0,
  ttsVoice: '',
}

function readFavorites(): Story[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as Story[]
  } catch {
    return []
  }
}

function writeFavorites(stories: Story[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(stories))
}

export const storageService = {
  async getFavorites(): Promise<Story[]> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.getFavorites()
    }
    return readFavorites()
  },

  async saveFavorite(story: Story): Promise<Story> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.saveFavorite(story)
    }
    const favorites = readFavorites()
    const saved: Story = {
      ...story,
      id: Date.now(),
      savedAt: new Date().toISOString(),
    }
    writeFavorites([saved, ...favorites])
    return saved
  },

  async deleteFavorite(id: number): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.deleteFavorite(id)
      return
    }
    writeFavorites(readFavorites().filter(f => f.id !== id))
  },

  async getFavorite(id: number): Promise<Story> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.getFavorite(id)
    }
    const found = readFavorites().find(f => f.id === id)
    if (!found) throw new Error('Story not found')
    return found
  },

  async getSettings(): Promise<Settings> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.getSettings()
    }
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Settings>
      return { ...defaultSettings, ...stored }
    } catch {
      return { ...defaultSettings }
    }
  },

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.saveSettings(settings)
      return
    }
    const current = await storageService.getSettings()
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  },
}
