# StorySpark

A cross-platform mobile storytelling app that generates unique AI stories based on your preferences. Built with **React Native + Expo**.

## Features

| Feature | Details |
|---|---|
| AI Story Generation | Fantasy, Horror, Mystery, Adventure, Sci-Fi, Romance, Comedy, or Custom |
| Story Lengths | Short (~300 words), Medium (~700 words), Long (~1500 words) |
| AI Illustrations | Matching placeholder image per genre; plug in DALL-E or Stable Diffusion for real art |
| Text-to-Speech | Device TTS via `expo-speech` — play, pause, stop |
| Favorites | Save/unsave stories locally with AsyncStorage |
| Dark Mode | Full light and dark theme that follows the device setting |
| Responsive | Works on phones of all sizes, tablets, and Expo Web |

## Prerequisites

- **Node.js** 18+
- **npm** 9+ (included with Node)
- [**Expo Go**](https://expo.dev/client) app on your phone **or** an iOS Simulator / Android Emulator

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd StorySpark
npm install

# 2. Add your API key (see Configuration below)

# 3. Start the development server
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS) to run the app instantly on your device.

## Configuration

### Anthropic API Key — Story Generation

Open `src/services/aiService.js` and replace the placeholder:

```js
// Before
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

// After
const ANTHROPIC_API_KEY = 'sk-ant-api03-...';
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

> **Without a key** the app runs in placeholder mode — it shows sample stories so you can explore the full UI immediately.

### Image Generation API — Illustrations (Optional)

`generateIllustration()` in `src/services/aiService.js` currently returns colored placeholder images. To enable real AI art, replace that function body with a call to one of:

| Provider | Endpoint |
|---|---|
| DALL-E 3 (OpenAI) | `https://api.openai.com/v1/images/generations` |
| Stable Diffusion (Stability AI) | `https://api.stability.ai/v1/generation/...` |
| Ideogram / Replicate | See their respective docs |

The function must return a `Promise<string>` resolving to a publicly accessible image URL.

## Running on Different Targets

```bash
npx expo start        # Interactive menu — scan QR for device
npx expo start --ios  # Open in iOS Simulator (requires Xcode on macOS)
npx expo start --android  # Open in Android Emulator (requires Android Studio)
npx expo start --web  # Open in browser (limited TTS support)
```

## Project Structure

```
StorySpark/
├── App.js                         # Root component; reads device color scheme
├── app.json                       # Expo config (name, slug, bundle IDs)
├── package.json
└── src/
    ├── screens/
    │   ├── HomeScreen.js          # Genre/length pickers + Generate button
    │   ├── StoryScreen.js         # Reading view with TTS, favorites, illustration
    │   └── FavoritesScreen.js     # Saved stories list with delete
    ├── components/
    │   ├── GenreDropdown.js       # Modal genre picker with genre icons
    │   ├── LengthDropdown.js      # Modal length picker with word counts
    │   ├── StoryCard.js           # Reusable card used in Favorites list
    │   ├── LoadingAnimation.js    # Three-dot bounce animation
    │   └── IllustrationPlaceholder.js  # Image with loading + error states
    ├── services/
    │   ├── aiService.js           # Claude API calls + illustration stub
    │   └── storageService.js      # AsyncStorage CRUD for favorites
    ├── hooks/
    │   └── useTTS.js              # expo-speech play / pause / stop hook
    ├── theme/
    │   └── index.js               # Light and dark color palettes
    └── navigation/
        └── AppNavigator.js        # Bottom tabs (Home, Favorites) + Home stack
```

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | React Native + Expo | ~51 |
| Navigation | React Navigation | 6.x |
| Text-to-Speech | expo-speech | ~12 |
| Local Storage | @react-native-async-storage/async-storage | 1.23 |
| Icons | @expo/vector-icons (Ionicons) | 14 |
| Animations | react-native-reanimated | ~3.10 |
| Gradients | expo-linear-gradient | ~13 |
| AI Stories | Anthropic Claude API | claude-haiku-4-5-20251001 |

## How It Works

1. User picks a **genre** and **length** on the Home screen.
2. Tapping **Generate Story** calls the Anthropic API (or returns a placeholder).
3. The app navigates to **StoryScreen** and simultaneously fetches an illustration.
4. Users can **listen** (TTS), **save** (heart icon), or go back and generate another.
5. Saved stories live in the **Favorites** tab and can be re-opened or deleted.

## Troubleshooting

| Problem | Fix |
|---|---|
| "API error 401" | Check your `ANTHROPIC_API_KEY` value in `aiService.js` |
| Illustration not loading | The placehold.co service requires internet access; check your connection |
| TTS not working | TTS is device-dependent; not supported in all Expo Web browsers |
| Metro bundler cache | Run `npx expo start --clear` to reset the cache |
