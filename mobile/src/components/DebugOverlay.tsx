// DebugOverlay - Mostra informazioni di debug direttamente nell'UI
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface DebugOverlayProps {
  data: Record<string, unknown>;
  title?: string;
}

export function DebugOverlay({ data, title = 'Debug' }: DebugOverlayProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false);

  // Solo in sviluppo
  if (!__DEV__) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <Text style={styles.title}>{title} {expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {expanded && (
        <ScrollView style={styles.content} nestedScrollEnabled>
          <Text style={styles.json}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 8,
    margin: 8,
    overflow: 'hidden',
  },
  header: {
    padding: 8,
    backgroundColor: '#333',
  },
  title: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    maxHeight: 200,
    padding: 8,
  },
  json: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 10,
  },
});
