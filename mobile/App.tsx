import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/store/AuthContext';
import { LeagueProvider } from '@/store/LeagueContext';
import AppNavigator from '@/navigation/AppNavigator';

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6366F1',
    background: '#1a1a2e',
    card: '#252542',
    text: '#FFFFFF',
    border: '#374151',
    notification: '#6366F1',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LeagueProvider>
          <NavigationContainer theme={DarkTheme}>
            <StatusBar style="light" />
            <AppNavigator />
          </NavigationContainer>
        </LeagueProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
