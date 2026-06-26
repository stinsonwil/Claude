import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  SafeAreaView, StatusBar, TouchableOpacity, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import StoryCard from '../components/StoryCard';
import { loadFavorites, removeFavorite } from '../services/storageService';

export default function FavoritesScreen({ navigation, theme }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reload favorites every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadFavorites().then(data => {
        setFavorites(data);
        setLoading(false);
      });
    }, [])
  );

  const handleDelete = useCallback((title) => {
    Alert.alert('Remove Story', 'Remove this story from favorites?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const updated = await removeFavorite(title);
          setFavorites(updated);
        },
      },
    ]);
  }, []);

  const handleOpen = useCallback((story) => {
    navigation.navigate('HomeTab', {
      screen: 'Story',
      params: { story, illustrationPromise: null },
    });
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.text === '#F9FAFB' ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Saved Stories</Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {favorites.length} {favorites.length === 1 ? 'story' : 'stories'}
        </Text>
      </View>

      {!loading && favorites.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="heart-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No saved stories yet</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Generate a story and tap the heart icon to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => item.title + item.savedAt}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <StoryCard
              story={item}
              onPress={handleOpen}
              onDelete={handleDelete}
              theme={theme}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  count: { fontSize: 14, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
