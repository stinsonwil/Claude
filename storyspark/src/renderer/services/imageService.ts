export const imageService = {
  async generate(prompt: string, apiKey: string): Promise<string> {
    const result = await window.electronAPI.generateImage({ prompt, apiKey })
    return result.url
  },

  buildPromptFromStory(title: string, genre: string, excerpt: string): string {
    return `${title} - A ${genre} story. Scene: ${excerpt.slice(0, 200)}`
  },
}
