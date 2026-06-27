import { IpcMain } from 'electron'

interface StoryParams {
  genre: string
  length: string
  customPrompt?: string
  apiKey: string
  model: string
}

interface ImageParams {
  prompt: string
  apiKey: string
}

const lengthMap: Record<string, { tokens: number; description: string }> = {
  short: { tokens: 500, description: 'a short story (about 300-500 words)' },
  medium: { tokens: 1200, description: 'a medium-length story (about 800-1200 words)' },
  long: { tokens: 2500, description: 'a long story (about 1500-2500 words)' },
}

export function registerStoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('story:generate', async (_event, params: StoryParams) => {
    const { genre, length, customPrompt, apiKey, model } = params

    if (!apiKey) {
      throw new Error('Anthropic API key is required. Please add it in Settings.')
    }

    const lengthInfo = lengthMap[length] || lengthMap.medium
    const systemPrompt = `You are a creative storytelling AI. Write engaging, vivid stories with strong characters and compelling narratives. Format your response as just the story text with a title on the first line followed by two newlines, then the story content.`

    const userPrompt = `Write ${lengthInfo.description} in the ${genre !== 'custom' ? genre : 'specified'} genre. ${customPrompt ? `Theme/prompt: ${customPrompt}` : ''} Make it captivating and well-structured with a clear beginning, middle, and end.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: lengthInfo.tokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`)
    }

    const data = await response.json() as { content: Array<{ text: string }> }
    const text = data.content[0]?.text || ''

    const lines = text.split('\n')
    const title = lines[0].replace(/^#\s*/, '').trim()
    const content = lines.slice(1).join('\n').trim()

    return { title, content, genre, length, createdAt: new Date().toISOString() }
  })

  ipcMain.handle('image:generate', async (_event, params: ImageParams) => {
    const { prompt, apiKey } = params

    if (!apiKey) {
      throw new Error('OpenAI API key is required for image generation. Please add it in Settings.')
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: `Create a beautiful, atmospheric illustration for a story: ${prompt}. Style: cinematic, detailed, painterly artwork suitable for a book cover.`,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`Image API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`)
    }

    const data = await response.json() as { data: Array<{ url: string }> }
    return { url: data.data[0]?.url }
  })
}
