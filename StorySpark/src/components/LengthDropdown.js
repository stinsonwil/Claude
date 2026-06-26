import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LENGTHS = [
  { label: 'Short', desc: '~300 words · 2 min read', icon: 'flash' },
  { label: 'Medium', desc: '~700 words · 5 min read', icon: 'book-outline' },
  { label: 'Long', desc: '~1500 words · 10 min read', icon: 'library' },
];

export default function LengthDropdown({ value, onChange, theme }) {
  const [open, setOpen] = useState(false);
  const selected = LENGTHS.find(l => l.label === value) || LENGTHS[0];

  return (
    <View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Story Length</Text>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.triggerInner}>
          <Ionicons name={selected.icon} size={18} color={theme.primary} />
          <Text style={[styles.triggerText, { color: theme.text }]}>{selected.label}</Text>
          <Text style={[styles.triggerDesc, { color: theme.textSecondary }]}>{selected.desc}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {LENGTHS.map(item => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, item.label === value && { backgroundColor: theme.primaryLight }]}
                onPress={() => { onChange(item.label); setOpen(false); }}
              >
                <Ionicons name={item.icon} size={20} color={item.label === value ? theme.primary : theme.textSecondary} />
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: item.label === value ? theme.primary : theme.text }]}>{item.label}</Text>
                  <Text style={[styles.menuDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
                </View>
                {item.label === value && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  triggerText: { fontSize: 16, fontWeight: '500' },
  triggerDesc: { fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  menu: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  menuTextWrap: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '500' },
  menuDesc: { fontSize: 12, marginTop: 2 },
});
