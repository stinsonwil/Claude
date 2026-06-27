import React, { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function IllustrationPlaceholder({ uri, theme }) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  // Pulse animation shown while waiting for the URI to resolve
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (uri) return; // stop pulsing once URI arrives
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [uri]);

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryLight }]}>
      {imageError || !uri ? (
        // Shows pulsing placeholder while URI is pending, or icon on error
        <Animated.View style={[styles.fallback, { opacity: uri ? 1 : pulseAnim }]}>
          <Ionicons
            name={uri ? 'image-outline' : 'color-wand-outline'}
            size={48}
            color={theme.primary}
          />
        </Animated.View>
      ) : (
        <>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
