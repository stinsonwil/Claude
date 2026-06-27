import { Story } from '../types'

interface GenerateParams {
  genre: string
  length: string
  customPrompt?: string
  apiKey: string
  model: string
}

const lengthMap: Record<string, { tokens: number; description: string }> = {
  short: { tokens: 500, description: 'a short story (about 300-500 words)' },
  medium: { tokens: 1200, description: 'a medium-length story (about 800-1200 words)' },
  long: { tokens: 2500, description: 'a long story (about 1500-2500 words)' },
}

export const storyService = {
  async generate(params: GenerateParams): Promise<Story> {
    // In Electron, delegate to main process. In web, call API directly via Vite proxy.
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.generateStory(params)
    }

    const { genre, length, customPrompt, apiKey, model } = params
    if (!apiKey) throw new Error('Anthropic API key is required. Please add it in Settings.')

    const lengthInfo = lengthMap[length] || lengthMap.medium
    const userPrompt = `Write ${lengthInfo.description} in the ${genre !== 'custom' ? genre : 'specified'} genre. ${customPrompt ? `Theme/prompt: ${customPrompt}` : ''} Make it captivating with a clear beginning, middle, and end.`

    const res = await fetch('/api/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: lengthInfo.tokens,
        system: 'You are a creative storytelling AI. Write engaging, vivid stories. Format your response with a title on the first line followed by two newlines, then the story content.',
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`API error: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json() as { content: Array<{ text: string }> }
    const text = data.content[0]?.text || ''
    const lines = text.split('\n')
    const title = lines[0].replace(/^#\s*/, '').trim()
    const content = lines.slice(1).join('\n').trim()

    return { title, content, genre, length, createdAt: new Date().toISOString() }
  },
}
