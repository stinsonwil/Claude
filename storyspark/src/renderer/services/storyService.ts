import { Story } from '../types'

interface GenerateParams {
  genre: string
  length: string
  customPrompt?: string
  apiKey: string
  model: string
}

export const storyService = {
  async generate(params: GenerateParams): Promise<Story> {
    return window.electronAPI.generateStory(params)
  },
}
