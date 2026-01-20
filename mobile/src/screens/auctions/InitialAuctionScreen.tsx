import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionsStackParamList } from '@/navigation/AppNavigator';

const COLORS = {
  background: '#1a1a2e',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  primary: '#6366F1',
};

type Props = NativeStackScreenProps<AuctionsStackParamList, 'InitialAuction'>;

export default function InitialAuctionScreen({ route }: Props): React.JSX.Element {
  const { leagueId } = route.params;

  return (
    <View style={styles.container}>
      <Ionicons name="flag-outline" size={64} color={COLORS.primary} />
      <Text style={styles.title}>Asta Iniziale</Text>
      <Text style={styles.leagueId}>Lega: {leagueId}</Text>
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
  leagueId: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
});
