import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GENRES = ['Fantasy', 'Horror', 'Mystery', 'Adventure', 'Sci-Fi', 'Romance', 'Comedy', 'Custom'];

const GENRE_ICONS = {
  Fantasy: 'sparkles',
  Horror: 'moon',
  Mystery: 'search',
  Adventure: 'compass',
  'Sci-Fi': 'planet',
  Romance: 'heart',
  Comedy: 'happy',
  Custom: 'create',
};

export default function GenreDropdown({ value, onChange, theme }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Genre</Text>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.triggerInner}>
          <Ionicons name={GENRE_ICONS[value] || 'book'} size={18} color={theme.primary} />
          <Text style={[styles.triggerText, { color: theme.text }]}>{value}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <FlatList
              data={GENRES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.menuItem, item === value && { backgroundColor: theme.primaryLight }]}
                  onPress={() => { onChange(item); setOpen(false); }}
                >
                  <Ionicons name={GENRE_ICONS[item]} size={18} color={item === value ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.menuText, { color: item === value ? theme.primary : theme.text }]}>{item}</Text>
                  {item === value && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  triggerText: { fontSize: 16, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  menu: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', maxHeight: 380 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  menuText: { flex: 1, fontSize: 16 },
});
