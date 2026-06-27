import { Story, Settings } from '../types'

export const storageService = {
  async getFavorites(): Promise<Story[]> {
    return window.electronAPI.getFavorites()
  },

  async saveFavorite(story: Story): Promise<Story> {
    return window.electronAPI.saveFavorite(story)
  },

  async deleteFavorite(id: number): Promise<void> {
    await window.electronAPI.deleteFavorite(id)
  },

  async getFavorite(id: number): Promise<Story> {
    return window.electronAPI.getFavorite(id)
  },

  async getSettings(): Promise<Settings> {
    return window.electronAPI.getSettings()
  },

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    await window.electronAPI.saveSettings(settings)
  },
}
