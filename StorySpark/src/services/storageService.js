import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@storyspark_favorites';

/** Load all saved favorite stories. */
export async function loadFavorites() {
  try {
    const json = await AsyncStorage.getItem(FAVORITES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

/** Save a story to favorites. Returns the updated list. */
export async function saveFavorite(story) {
  try {
    const existing = await loadFavorites();
    // Avoid exact duplicates by title
    const filtered = existing.filter(s => s.title !== story.title);
    const updated = [{ ...story, savedAt: new Date().toISOString() }, ...filtered];
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/** Remove a story from favorites by title. */
export async function removeFavorite(title) {
  try {
    const existing = await loadFavorites();
    const updated = existing.filter(s => s.title !== title);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/** Check if a story title is already saved. */
export async function isFavorite(title) {
  try {
    const existing = await loadFavorites();
    return existing.some(s => s.title === title);
  } catch {
    return false;
  }
}
