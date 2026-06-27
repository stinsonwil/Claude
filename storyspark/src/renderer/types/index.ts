export interface Story {
  id?: number
  title: string
  content: string
  genre: string
  length: string
  imageUrl?: string
  createdAt: string
  savedAt?: string
}

export interface Settings {
  anthropicApiKey: string
  openaiApiKey: string
  defaultModel: string
  defaultLength: string
  autoImageGen: boolean
  theme: 'light' | 'dark'
  ttsRate: number
  ttsVoice: string
}

export type Genre = 'fantasy' | 'horror' | 'mystery' | 'adventure' | 'sci-fi' | 'romance' | 'comedy' | 'custom'
export type Length = 'short' | 'medium' | 'long'

export interface ElectronAPI {
  generateStory: (params: {
    genre: string
    length: string
    customPrompt?: string
    apiKey: string
    model: string
  }) => Promise<Story>
  generateImage: (params: { prompt: string; apiKey: string }) => Promise<{ url: string }>
  getFavorites: () => Promise<Story[]>
  saveFavorite: (story: Story) => Promise<Story>
  deleteFavorite: (id: number) => Promise<{ success: boolean }>
  getFavorite: (id: number) => Promise<Story>
  getSettings: () => Promise<Settings>
  saveSettings: (settings: Partial<Settings>) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
