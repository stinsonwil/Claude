# StorySpark

An AI-powered storytelling desktop app built with Electron, React, and TypeScript.

## Features

- Generate stories using Claude AI (Anthropic)
- AI-illustrated stories via DALL-E 3 (OpenAI)
- Text-to-speech playback with speed control
- Save stories to favorites (SQLite)
- Dark/light mode
- Export as TXT or PDF

## Setup

1. Install dependencies: `npm install`
2. Add your API keys in the app's Settings page
3. Run: `npm run dev`

## API Keys

- **Anthropic**: Required for story generation — get at https://console.anthropic.com
- **OpenAI**: Optional — required for AI image generation — get at https://platform.openai.com

## Build

```bash
npm run build        # Current platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```
