import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  background: '#1a1a2e',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  primary: '#6366F1',
};

export default function ProfileScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Ionicons name="person-outline" size={64} color={COLORS.primary} />
      <Text style={styles.title}>Profilo</Text>
      <Text style={styles.subtitle}>In sviluppo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
});
