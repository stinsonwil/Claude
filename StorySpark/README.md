# StorySpark

A polished cross-platform mobile storytelling app that generates unique AI stories based on your preferences. Built with **React Native + Expo**.

![StorySpark](https://img.shields.io/badge/Expo-~51-blue) ![React Native](https://img.shields.io/badge/React%20Native-0.74-green) ![Claude AI](https://img.shields.io/badge/Claude-AI-purple)

---

## Features

| Feature | Details |
|---|---|
| **AI Story Generation** | Fantasy, Horror, Mystery, Adventure, Sci-Fi, Romance, Comedy, or Custom genre |
| **Custom Genre** | Type any genre you can imagine — Steampunk Western, Cosmic Horror, etc. |
| **Story Lengths** | Short (~300 words), Medium (~700 words), Long (~1500 words) |
| **AI Illustrations** | Matching illustration generated for every story |
| **Text-to-Speech** | Play/Pause/Stop using the device's built-in TTS engine |
| **Favorites** | Save stories locally with AsyncStorage; view and reopen them anytime |
| **Dark Mode** | Full light and dark theme, follows system preference |
| **Placeholder Mode** | Works immediately without an API key using sample content |

---

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Expo Go** app on your iOS or Android device — [expo.dev/client](https://expo.dev/client)
  - _or_ iOS Simulator (requires macOS + Xcode) / Android Emulator (requires Android Studio)

---

## Installation

```bash
git clone <repo-url>
cd StorySpark
npm install
```

---

## Configuration

### 1. Anthropic API Key (story generation)

Open `src/services/aiService.js` and replace the placeholder at the top:

```js
// Before
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

// After — replace with your actual key
const ANTHROPIC_API_KEY = 'sk-ant-api03-...';
```

Get a free API key at **[console.anthropic.com](https://console.anthropic.com)**.

> **No key? No problem.** The app runs in **placeholder mode** when the key is missing or invalid — you'll see sample stories and can explore the full UI immediately.

### 2. Image Generation API (optional)

The `generateIllustration` function in `src/services/aiService.js` currently returns colored placeholder images. To enable real AI illustrations, swap the function body with a call to one of:

- **DALL-E 3** (OpenAI) — `https://api.openai.com/v1/images/generations`
- **Stable Diffusion** (Stability AI) — `https://api.stability.ai/v1/generation/...`
- **Flux** (Black Forest Labs) — available via Replicate or fal.ai

The function signature to keep: `async function generateIllustration(title, genre)` → returns a `Promise<string>` that resolves to an image URI.

---

## Running the App

```bash
npx expo start
```

| Target | Action |
|---|---|
| **Physical device** | Scan the QR code with Expo Go |
| **iOS Simulator** | Press `i` in the terminal |
| **Android Emulator** | Press `a` in the terminal |
| **Web (preview only)** | Press `w` in the terminal |

---

## Project Structure

```
StorySpark/
├── App.js                        # Root component — applies theme, mounts navigator
├── app.json                      # Expo config (name, icons, orientation)
├── babel.config.js
├── package.json
└── src/
    ├── screens/
    │   ├── HomeScreen.js         # Genre & length selectors + Generate button
    │   ├── StoryScreen.js        # Reading view with illustration, TTS, favorites
    │   └── FavoritesScreen.js    # Saved stories list with open/delete
    ├── components/
    │   ├── GenreDropdown.js      # Modal genre picker with Ionicons
    │   ├── LengthDropdown.js     # Modal length picker with descriptions
    │   ├── StoryCard.js          # Reusable card used in FavoritesScreen
    │   ├── LoadingAnimation.js   # Three-dot bouncing animation
    │   └── IllustrationPlaceholder.js  # Image with pulse & spinner states
    ├── services/
    │   ├── aiService.js          # Claude API calls + illustration stubs
    │   └── storageService.js     # AsyncStorage CRUD for favorites
    ├── hooks/
    │   └── useTTS.js             # expo-speech play / pause / stop hook
    ├── theme/
    │   └── index.js              # lightTheme and darkTheme color palettes
    └── navigation/
        └── AppNavigator.js       # Bottom tab navigator + HomeStack
```

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native 0.74 + Expo ~51 |
| Navigation | React Navigation 6 (bottom tabs + stack) |
| Text-to-Speech | expo-speech |
| Local Storage | @react-native-async-storage/async-storage |
| Animations | react-native-reanimated + React Native Animated API |
| Icons | @expo/vector-icons (Ionicons) |
| Gradients | expo-linear-gradient |
| AI Stories | Anthropic Claude API (claude-haiku-4-5-20251001) |
| AI Images | Placeholder — swap in DALL-E 3 / Stable Diffusion / Flux |

---

## Adding New Genres

Genres are defined in two places:

1. **`src/components/GenreDropdown.js`** — `GENRES` array and `GENRE_ICONS` map
2. **`src/services/aiService.js`** — `generateIllustration` color map and placeholder `titles` map

Add your genre to all three maps to get full support including icons, colors, and placeholder stories.

---

## License

MIT
