import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Shows an illustration image with a spinner while the URL is being fetched
 * (loading=true) and a further spinner while the image itself loads.
 * Falls back to a genre-icon placeholder on error or missing URI.
 */
export default function IllustrationPlaceholder({ uri, loading = false, theme }) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Still waiting for the URL from the API
  if (loading && !uri) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryLight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // URL resolved but failed, or no URL at all
  if (!uri || imageError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryLight }]}>
        <Ionicons name="image-outline" size={48} color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryLight }]}>
      <Image
        source={{ uri }}
        style={styles.image}
        onLoad={() => setImageLoading(false)}
        onError={() => { setImageLoading(false); setImageError(true); }}
        resizeMode="cover"
      />
      {imageLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%', height: 200, borderRadius: 16,
    overflow: 'hidden', marginBottom: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
