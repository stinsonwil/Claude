export const imageService = {
  async generate(prompt: string, apiKey: string): Promise<string> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.generateImage({ prompt, apiKey })
      return result.url
    }

    if (!apiKey) throw new Error('OpenAI API key required for image generation.')

    const res = await fetch('/api/openai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: `Create a beautiful atmospheric illustration for a story: ${prompt}. Style: cinematic, detailed, painterly artwork suitable for a book cover.`,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`Image API error: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json() as { data: Array<{ url: string }> }
    return data.data[0]?.url ?? ''
  },

  buildPromptFromStory(title: string, genre: string, excerpt: string): string {
    return `${title} — A ${genre} story. Scene: ${excerpt.slice(0, 200)}`
  },
}
