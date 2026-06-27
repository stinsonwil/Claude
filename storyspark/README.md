# StorySpark

An AI-powered storytelling desktop application built with **Electron**, **React**, and **TypeScript**. Generate unique stories, listen to them, and save your favorites — all in a polished desktop interface.

## Features

- **AI Story Generation** — choose genre (Fantasy, Horror, Mystery, Adventure, Sci-Fi, Romance, Comedy, Custom) and length (Short/Medium/Long), powered by Anthropic Claude
- **AI Illustrations** — auto-generate or request a matching image via OpenAI DALL-E 3
- **Text-to-Speech** — Play, Pause, Resume, Stop with adjustable speed and voice selection (uses OS Web Speech API)
- **Favorites** — save stories locally in SQLite, search, reopen, and delete
- **Story Viewer** — adjustable font size, dark/light mode, copy to clipboard, export as TXT or PDF, regenerate
- **Settings** — manage API keys, default model, length, theme, and TTS preferences
- **Cross-platform** — runs on Windows, macOS, and Linux

## Prerequisites

- Node.js 18+ and npm
- An [Anthropic API key](https://console.anthropic.com) (required for story generation)
- An [OpenAI API key](https://platform.openai.com) (optional — required for DALL-E 3 image generation)

## Installation

```bash
# Clone and install
npm install

# Start in development mode
npm run dev
```

On first launch, open **Settings** and enter your API keys. They are stored locally in SQLite (never transmitted anywhere except the respective APIs).

## Project Structure

```
storyspark/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── main.ts            # App entry, BrowserWindow
│   │   ├── preload.ts         # contextBridge API (secure IPC)
│   │   └── ipc/
│   │       ├── storyHandlers.ts    # Story & image generation (Anthropic + OpenAI)
│   │       ├── storageHandlers.ts  # SQLite favorites (better-sqlite3)
│   │       └── settingsHandlers.ts # SQLite settings
│   └── renderer/              # React frontend
│       ├── App.tsx            # Router + ThemeProvider
│       ├── pages/
│       │   ├── Home.tsx       # Genre/length picker + generate button
│       │   ├── StoryViewer.tsx# Story display, TTS, export, save
│       │   ├── Favorites.tsx  # Saved stories with search
│       │   └── Settings.tsx   # API keys, preferences
│       ├── components/        # Reusable UI (Layout, Sidebar, Toast, Spinner)
│       ├── services/          # Thin IPC wrappers
│       ├── hooks/             # useTTS, useToast, useTheme
│       └── types/             # Shared TypeScript types
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json         # Main process TypeScript config
├── electron-builder.yml       # Packaging config
└── .env.example               # API key reference
```

## Building for Distribution

```bash
npm run build         # Build for current platform
npm run build:win     # Windows installer (NSIS)
npm run build:mac     # macOS .dmg
npm run build:linux   # Linux AppImage
```

Packaged outputs appear in the `release/` directory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 28 |
| Frontend | React 18 + TypeScript |
| Bundler | Vite 5 |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Routing | React Router 6 |
| Local storage | better-sqlite3 |
| Packaging | electron-builder |

## Adding Features

The architecture is designed to be extended:

- **New AI providers** — add handlers in `src/main/ipc/storyHandlers.ts` and expose them via `preload.ts`
- **New pages** — add a React page in `src/renderer/pages/`, add a route in `App.tsx`, and a nav item in `components/Sidebar.tsx`
- **New settings** — extend the `Settings` interface in `src/renderer/types/index.ts` and the settings handlers in `src/main/ipc/settingsHandlers.ts`

## Security Notes

- `nodeIntegration` is **disabled** — all Node.js access goes through the secure `contextBridge` in `preload.ts`
- API keys are stored in SQLite in the OS user data directory, not in environment variables at runtime
- No remote code execution — all story/image content is rendered as plain text and `<img>` tags

