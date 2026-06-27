import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GENRE_ICONS = {
  Fantasy: 'sparkles', Horror: 'moon', Mystery: 'search',
  Adventure: 'compass', 'Sci-Fi': 'planet', Romance: 'heart',
  Comedy: 'happy', Custom: 'create',
};

export default function StoryCard({ story, onPress, onDelete, theme }) {
  const date = story.savedAt ? new Date(story.savedAt).toLocaleDateString() : '';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.cardShadow }]}
      onPress={() => onPress(story)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.primaryLight }]}>
        <Ionicons name={GENRE_ICONS[story.genre] || 'book'} size={22} color={theme.primary} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{story.title}</Text>
        <View style={styles.meta}>
          <Text style={[styles.badge, { backgroundColor: theme.primaryLight, color: theme.primary }]}>{story.genre}</Text>
          <Text style={[styles.badge, { backgroundColor: theme.primaryLight, color: theme.primary }]}>{story.length}</Text>
          {date ? <Text style={[styles.date, { color: theme.textSecondary }]}>{date}</Text> : null}
        </View>
      </View>
      {onDelete && (
        <TouchableOpacity onPress={() => onDelete(story.title)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={theme.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 12, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  date: { fontSize: 11 },
  deleteBtn: { padding: 4 },
});
