# StorySpark

A cross-platform mobile storytelling app that generates unique AI stories based on your preferences. Built with React Native + Expo.

## Features

- **AI Story Generation** — Fantasy, Horror, Mystery, Adventure, Sci-Fi, Romance, Comedy, or Custom genres
- **AI Illustrations** — Each story includes a matching illustration
- **Text-to-Speech** — Listen to stories with the device's built-in TTS engine
- **Favorites** — Save and revisit stories locally (AsyncStorage)
- **Dark Mode** — Full light and dark theme support
- **Short / Medium / Long** story lengths (~300 / ~700 / ~1500 words)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo Go](https://expo.dev/client) on your phone, or an iOS Simulator / Android Emulator

## Installation

```bash
git clone <repo-url>
cd StorySpark
npm install
```

## Configuration

### Anthropic API Key (story generation)

Open `src/services/aiService.js` and replace the placeholder:

```js
const ANTHROPIC_API_KEY = 'sk-ant-...your-key-here...';
```

Get a key at [console.anthropic.com](https://console.anthropic.com). The app runs in **placeholder mode** without a key so you can explore the UI immediately.

### Image Generation API (illustrations)

The `generateIllustration` function in `src/services/aiService.js` currently returns placeholder images from placehold.co. To enable real AI illustrations, replace that function with a call to:

- **DALL-E 3** (OpenAI) — `https://api.openai.com/v1/images/generations`
- **Stable Diffusion** (stability.ai) — `https://api.stability.ai/v1/generation/...`

The function must return a `Promise<string>` that resolves to an image URI.

## Running the App

```bash
npx expo start
```

- **Physical device** — scan the QR code with Expo Go (iOS or Android)
- **iOS Simulator** — press `i` in the terminal (requires Xcode on macOS)
- **Android Emulator** — press `a` in the terminal (requires Android Studio)

## Project Structure

```
StorySpark/
├── App.js                      # Root component, theme provider
├── app.json                    # Expo config
├── package.json
└── src/
    ├── screens/
    │   ├── HomeScreen.js       # Genre/length selectors + Generate button
    │   ├── StoryScreen.js      # Story reading view with TTS and favorites
    │   └── FavoritesScreen.js  # Saved stories list
    ├── components/
    │   ├── GenreDropdown.js    # Modal genre picker with icons
    │   ├── LengthDropdown.js   # Modal length picker with descriptions
    │   ├── StoryCard.js        # Reusable card for favorites list
    │   ├── LoadingAnimation.js # Three-dot bounce animation
    │   └── IllustrationPlaceholder.js  # Image with loading state
    ├── services/
    │   ├── aiService.js        # Claude API + illustration API calls
    │   └── storageService.js   # AsyncStorage CRUD for favorites
    ├── hooks/
    │   └── useTTS.js           # expo-speech play/pause/stop hook
    ├── theme/
    │   └── index.js            # Light and dark color palettes
    └── navigation/
        └── AppNavigator.js     # Bottom tabs + stack navigator
```

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native + Expo ~51 |
| Navigation | React Navigation 6 (bottom tabs + stack) |
| Text-to-Speech | expo-speech |
| Local Storage | @react-native-async-storage/async-storage |
| Icons | @expo/vector-icons (Ionicons) |
| Animations | react-native-reanimated |
| AI Stories | Anthropic Claude API (claude-haiku-4-5) |
