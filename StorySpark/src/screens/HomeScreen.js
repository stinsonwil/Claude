import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, StatusBar, SafeAreaView, TextInput, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GenreDropdown from '../components/GenreDropdown';
import LengthDropdown from '../components/LengthDropdown';
import LoadingAnimation from '../components/LoadingAnimation';
import { generateStory, generateIllustration } from '../services/aiService';

export default function HomeScreen({ navigation, theme }) {
  const [genre, setGenre] = useState('Fantasy');
  const [customGenre, setCustomGenre] = useState('');
  const [length, setLength] = useState('Medium');
  const [loading, setLoading] = useState(false);
  // Fade-in animation for the custom input field
  const customInputOpacity = useRef(new Animated.Value(0)).current;

  function handleGenreChange(newGenre) {
    setGenre(newGenre);
    Animated.timing(customInputOpacity, {
      toValue: newGenre === 'Custom' ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }

  async function handleGenerate() {
    if (loading) return;

    const resolvedGenre = genre === 'Custom'
      ? (customGenre.trim() || 'Custom')
      : genre;

    setLoading(true);
    try {
      const result = await generateStory(resolvedGenre, length);
      // Start illustration in parallel — don't block navigation on it
      const illustrationPromise = generateIllustration(result.title, resolvedGenre);
      navigation.navigate('Story', { story: result, illustrationPromise });
    } catch (err) {
      Alert.alert(
        'Story Generation Failed',
        err.message || 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.text === '#F9FAFB' ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoWrap, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="sparkles" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.appName, { color: theme.primary }]}>StorySpark</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            AI-powered stories, crafted just for you
          </Text>
        </View>

        {/* Selection card */}
        <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.cardShadow }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Craft Your Story</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Choose a genre and length to get started
          </Text>

          <View style={styles.fieldGap}>
            <GenreDropdown value={genre} onChange={handleGenreChange} theme={theme} />
          </View>

          {/* Custom genre text input — fades in when Custom is selected */}
          <Animated.View style={[styles.fieldGap, { opacity: customInputOpacity }]}>
            {genre === 'Custom' && (
              <View>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Custom Genre</Text>
                <TextInput
                  value={customGenre}
                  onChangeText={setCustomGenre}
                  placeholder="e.g. Steampunk Western, Time Travel..."
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.textInput,
                    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                  ]}
                  maxLength={60}
                  returnKeyType="done"
                />
              </View>
            )}
          </Animated.View>

          <View style={styles.fieldGap}>
            <LengthDropdown value={length} onChange={setLength} theme={theme} />
          </View>
        </View>

        {/* Generate button */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={loading}
          activeOpacity={0.85}
          style={styles.btnWrap}
        >
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <LoadingAnimation color="#FFFFFF" />
                <Text style={styles.generateText}>Crafting your story…</Text>
              </View>
            ) : (
              <View style={styles.btnContent}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                <Text style={styles.generateText}>Generate Story</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info hint */}
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Powered by Claude AI · Add your API key in aiService.js
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32, paddingTop: 8 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  appName: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 15, marginTop: 6, textAlign: 'center' },
  card: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSub: { fontSize: 13, marginBottom: 20 },
  fieldGap: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13, fontWeight: '600', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15,
  },
  btnWrap: { borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  generateBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  generateBtnDisabled: { opacity: 0.85 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 12 },
});
