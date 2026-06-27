import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Story generation
  generateStory: (params: { genre: string; length: string; customPrompt?: string; apiKey: string; model: string }) =>
    ipcRenderer.invoke('story:generate', params),

  // Image generation
  generateImage: (params: { prompt: string; apiKey: string }) =>
    ipcRenderer.invoke('image:generate', params),

  // Storage - Favorites
  getFavorites: () => ipcRenderer.invoke('storage:getFavorites'),
  saveFavorite: (story: unknown) => ipcRenderer.invoke('storage:saveFavorite', story),
  deleteFavorite: (id: number) => ipcRenderer.invoke('storage:deleteFavorite', id),
  getFavorite: (id: number) => ipcRenderer.invoke('storage:getFavorite', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
})
