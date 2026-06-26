import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function IllustrationPlaceholder({ uri, theme }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryLight }]}>
      {error || !uri ? (
        <View style={styles.fallback}>
          <Ionicons name="image-outline" size={48} color={theme.primary} />
        </View>
      ) : (
        <>
          <Image
            source={{ uri }}
            style={styles.image}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            resizeMode="cover"
          />
          {loading && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  image: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
