import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import IllustrationPlaceholder from '../components/IllustrationPlaceholder';
import { useTTS } from '../hooks/useTTS';
import { saveFavorite, removeFavorite, isFavorite } from '../services/storageService';
import { generateIllustration } from '../services/aiService';

export default function StoryScreen({ navigation, route, theme }) {
  const { story } = route.params;
  const [illustrationUri, setIllustrationUri] = useState(null);
  const [illustrationLoading, setIllustrationLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const { isSpeaking, speak, stop } = useTTS();

  // Fetch illustration independently — safe because no Promise is in route params
  useEffect(() => {
    let cancelled = false;
    generateIllustration(story.title, story.genre)
      .then(uri => { if (!cancelled) { setIllustrationUri(uri); setIllustrationLoading(false); } })
      .catch(() => { if (!cancelled) setIllustrationLoading(false); });
    return () => { cancelled = true; };
  }, [story.title, story.genre]);

  // Check favorites status
  useEffect(() => {
    isFavorite(story.title).then(setFavorited);
  }, [story.title]);

  // Stop TTS when leaving screen
  useEffect(() => {
    return () => stop();
  }, []);

  const handleFavorite = useCallback(async () => {
    if (favorited) {
      await removeFavorite(story.title);
      setFavorited(false);
    } else {
      await saveFavorite(story);
      setFavorited(true);
    }
  }, [favorited, story]);

  // Toggle speak/pause; if already speaking call stop, otherwise start
  const handleTTS = useCallback(() => {
    speak(`${story.title}. ${story.story}`);
  }, [story, speak]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.text === '#F9FAFB' ? 'light-content' : 'dark-content'} />

      {/* Nav bar */}
      <View style={[styles.navbar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => { stop(); navigation.goBack(); }} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.text }]} numberOfLines={1}>{story.genre} Story</Text>
        <View style={styles.navActions}>
          <TouchableOpacity onPress={handleTTS} style={styles.navBtn}>
            <Ionicons name={isSpeaking ? 'pause-circle' : 'play-circle'} size={26} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFavorite} style={styles.navBtn}>
            <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={24} color={favorited ? '#EF4444' : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Illustration */}
        <IllustrationPlaceholder uri={illustrationUri} loading={illustrationLoading} theme={theme} />

        {/* Genre / length badges */}
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="bookmark" size={13} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary }]}>{story.genre}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="time-outline" size={13} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary }]}>{story.length}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]}>{story.title}</Text>

        {/* TTS active indicator */}
        {isSpeaking && (
          <View style={[styles.ttsBar, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="volume-high" size={16} color={theme.primary} />
            <Text style={[styles.ttsText, { color: theme.primary }]}>Reading aloud… tap pause to stop</Text>
          </View>
        )}

        {/* Story body */}
        <Text style={[styles.storyText, { color: theme.text }]}>{story.story}</Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primaryLight }]}
            onPress={handleTTS}
          >
            <Ionicons name={isSpeaking ? 'stop-circle' : 'headset'} size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: favorited ? '#FEE2E2' : theme.primaryLight }]}
            onPress={handleFavorite}
          >
            <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={20} color={favorited ? '#EF4444' : theme.primary} />
            <Text style={[styles.actionText, { color: favorited ? '#EF4444' : theme.primary }]}>
              {favorited ? 'Saved' : 'Save Story'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1,
  },
  navBtn: { padding: 8 },
  navTitle: { flex: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  navActions: { flexDirection: 'row' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 16, letterSpacing: -0.3 },
  ttsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, marginBottom: 16,
  },
  ttsText: { fontSize: 13, fontWeight: '500' },
  storyText: { fontSize: 16, lineHeight: 28, letterSpacing: 0.1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  actionText: { fontSize: 14, fontWeight: '600' },
});
