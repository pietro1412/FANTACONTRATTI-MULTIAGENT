# Native App Sprint Plan — Fantacontratti

> Questo file guida una nuova sessione Claude Code per completare l'app nativa React Native / Expo sul branch MOBILE-ANDROID.
> Leggi TUTTO questo file prima di iniziare qualsiasi sviluppo.

---

## Contesto

| Campo | Valore |
|-------|--------|
| Data | 2026-02-08 |
| Branch | `MOBILE-ANDROID` |
| Stack | React Native 0.76.9 + Expo SDK ~52.0.0 |
| Linguaggio | TypeScript 5.6.3 (strict mode) |
| Navigazione | React Navigation 6 (native-stack + bottom-tabs) |
| Stato Globale | Context API (AuthContext, LeagueContext, NotificationContext) |
| HTTP Client | Axios + JWT (SecureStore) |
| Real-time | Pusher.js 8.4.0 (react-native variant) |
| Prerequisiti | Node.js 20+, Expo CLI, Android Studio / Xcode |

### Struttura Navigazione Esistente
```
RootStack
  ├── AuthStack → LoginScreen
  └── MainStack → BottomTabs
        ├── HomeTab → HomeScreen, LeagueSelectionScreen
        ├── RosaTab → RosterScreen
        ├── MercatoTab → AuctionsScreen, AuctionDetailScreen, InitialAuctionScreen, RepairAuctionScreen, IndemnityScreen
        ├── ScambiTab → TradesScreen, TradeDetailScreen, CreateTradeScreen
        └── AltroTab → MoreScreen, HistoryScreen, SettingsScreen, ProfileScreen, ContractsScreen
```

### Schermate Esistenti (Implementate)
- `LoginScreen` — Login con email/password, JWT, SecureStore
- `HomeScreen` — Dashboard con stats, azioni rapide, pull-to-refresh
- `LeagueSelectionScreen` — Selezione lega con lista e invito
- `RosterScreen` — Rosa giocatori con filtri posizione, FlatList, pull-to-refresh
- `ContractsScreen` — Lista contratti con visualizzazione

### Schermate Stub (Solo Placeholder "In sviluppo")
- `AuctionsScreen`, `AuctionDetailScreen`, `InitialAuctionScreen`, `RepairAuctionScreen`
- `IndemnityScreen`
- `TradesScreen`, `TradeDetailScreen`, `CreateTradeScreen`
- `HistoryScreen`, `SettingsScreen`, `ProfileScreen`
- `MoreScreen`

### File Esistenti
```
mobile/
  ├── App.tsx
  ├── app.json
  ├── package.json
  ├── tsconfig.json
  ├── babel.config.js
  └── src/
      ├── navigation/AppNavigator.tsx
      ├── screens/
      │   ├── auth/LoginScreen.tsx
      │   ├── home/HomeScreen.tsx, LeagueSelectionScreen.tsx
      │   ├── roster/RosterScreen.tsx
      │   ├── contracts/ContractsScreen.tsx
      │   ├── auctions/AuctionsScreen.tsx, AuctionDetailScreen.tsx, InitialAuctionScreen.tsx, RepairAuctionScreen.tsx, IndemnityScreen.tsx
      │   ├── trades/TradesScreen.tsx, TradeDetailScreen.tsx, CreateTradeScreen.tsx
      │   └── more/MoreScreen.tsx, HistoryScreen.tsx, SettingsScreen.tsx, ProfileScreen.tsx
      ├── services/api.ts, pusher.ts
      ├── store/AuthContext.tsx, LeagueContext.tsx, NotificationContext.tsx
      └── types/index.ts
```

### Colori da Allineare (Web → App)
```typescript
// ATTUALE (app)                    // TARGET (allineare a web)
background: '#1a1a2e'        →     '#0a0a0b'
card: '#252542'              →     '#1a1c20'
cardHighlight: '#2d2d4a'     →     '#252830'
primary: '#6366F1'           →     '#3b82f6'
text: '#FFFFFF'              →     '#f3f4f6'
textSecondary: '#9CA3AF'     →     '#9ca3af'   (uguale)
border: '#374151'            →     'rgba(42,49,66,0.2)'
success: '#10B981'           →     '#22c55e'
warning: '#F59E0B'           →     '#f59e0b'   (uguale)
danger: '#EF4444'            →     '#ef4444'   (uguale)
```

---

## Regole Operative

### Workflow Git
```
1. git checkout MOBILE-ANDROID && git pull origin MOBILE-ANDROID
2. Implementare i task dello sprint
3. Commit con task ID: "feat(mobile): APP-xxx descrizione"
4. Push: git push origin MOBILE-ANDROID
```

### Convenzioni
- Commit: `feat(mobile):` per nuove feature, `fix(mobile):` per bug, `refactor(mobile):` per refactoring
- Path alias: `@/` mappa a `mobile/src/` (configurato in babel.config.js con module-resolver)
- Pattern: ogni schermata ha sezioni `Constants`, `Types`, `Sub-Components`, `Main Component`, `Styles`
- Colori: usare la costante `COLORS` locale in ogni file (fino a quando il tema non viene centralizzato in N1)
- Componenti RN: usare `StyleSheet.create()`, mai inline styles ripetuti
- TouchableOpacity: sempre con `activeOpacity={0.7}`
- FlatList preferita a ScrollView + map per liste lunghe
- RefreshControl: colori `tintColor={colors.primary}` + `colors={[colors.primary]}`
- Nessuna dipendenza aggiuntiva senza conferma esplicita dell'utente

### Struttura Tipo di una Schermata
```typescript
// mobile/src/screens/example/ExampleScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';      // dopo Sprint N1
import { useLeague } from '@/store/LeagueContext';
import { exampleApi } from '@/services/api';

// Sub-components ...
// Main component ...
// Styles ...
```

---

## Mappa Task

| Task | Titolo | Sprint | Sforzo | Dipendenze |
|------|--------|--------|--------|------------|
| APP-004 | Configurare API URL da Environment | N1 | S | - |
| APP-005 | Allineare Tema Colori | N1 | M | - |
| APP-006 | Error Boundary | N1 | S | - |
| APP-012 | Skeleton Loading | N1 | M | APP-005 |
| APP-013 | Pull-to-Refresh (sistematico) | N1 | S | APP-005 |
| APP-007 | Registration Screen | N1 | M | APP-005 |
| APP-001 | Asta Iniziale (InitialAuctionScreen) | N2 | XL | N1 |
| APP-002 | Asta Riparazione (RepairAuctionScreen) | N2 | L | APP-001 |
| APP-008 | Rubata / Indennizzi (IndemnityScreen) | N2 | L | N1 |
| APP-003 | Scambi (TradesScreen + flusso) | N3 | XL | N1 |
| APP-009 | Profilo (ProfileScreen) | N3 | M | N1 |
| APP-010 | Impostazioni (SettingsScreen) | N3 | M | N1 |
| APP-011 | Storico (HistoryScreen) | N3 | M | N1 |
| APP-015 | Dettaglio Lega (LeagueDetailScreen) | N4 | M | N1 |
| APP-016 | Finanze Lega (FinancialsScreen) | N4 | L | N1 |
| APP-019 | Statistiche Giocatore (PlayerStatsScreen) | N4 | M | N1 |
| APP-020 | Tutti i Giocatori (AllPlayersScreen) | N4 | M | N1 |
| APP-021 | Movimenti (MovementsScreen) | N4 | M | N1 |
| APP-022 | Notifiche (NotificationsScreen) | N4 | S | N1 |
| APP-014 | Biometrics (FaceID / Fingerprint) | N5 | M | N1 |
| APP-017 | Deep Linking | N5 | M | N4 |
| APP-018 | Offline Mode | N5 | L | N1 |
| APP-026 | Haptics | N5 | S | N1 |
| APP-027 | Forgot Password | N5 | M | APP-007 |
| APP-023 | CI/CD con EAS Build | N6 | L | N5 |
| APP-024 | App Store / Play Store Prep | N6 | L | N5 |
| APP-025 | Analytics (Expo Analytics) | N6 | M | N5 |
| APP-028 | Animazioni (Reanimated) | N6 | M | N1 |

---

## SPRINT N1 — Foundation (~2 settimane, 6 task)

### Setup
```bash
git checkout MOBILE-ANDROID
git pull origin MOBILE-ANDROID
```

### Ordine di Implementazione
```
APP-004 (API URL) → APP-005 (Tema) → APP-006 (Error Boundary) → APP-012 (Skeleton) → APP-013 (Pull-to-Refresh) → APP-007 (Registrazione)
```
APP-004 e APP-005 sono propedeutici a tutto il resto.

---

#### N1.1 — APP-004: Configurare API URL da Environment (S, 1-3h)

**File da creare:** `mobile/app.config.js`
**File da modificare:** `mobile/src/services/api.ts`

**Cosa fare:**
1. Creare `mobile/app.config.js` per rendere l'API URL configurabile:
```javascript
// mobile/app.config.js
export default {
  expo: {
    ...require('./app.json').expo,
    extra: {
      apiUrl: process.env.API_URL || 'https://fantacontratti.vercel.app',
      pusherKey: process.env.PUSHER_KEY || 'e9bed48b0dd95a81e2fb',
      pusherCluster: process.env.PUSHER_CLUSTER || 'mt1',
    },
  },
};
```

2. Modificare `mobile/src/services/api.ts` — sostituire l'URL hardcoded:
```typescript
// PRIMA (attuale):
const API_BASE_URL = 'http://10.138.157.172:3003';

// DOPO:
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl
  || 'https://fantacontratti.vercel.app';
```

3. Modificare `mobile/src/services/pusher.ts` — sostituire le costanti hardcoded:
```typescript
// PRIMA:
const PUSHER_KEY = 'e9bed48b0dd95a81e2fb';
const PUSHER_CLUSTER = 'mt1';

// DOPO:
import Constants from 'expo-constants';

const PUSHER_KEY = Constants.expoConfig?.extra?.pusherKey || 'e9bed48b0dd95a81e2fb';
const PUSHER_CLUSTER = Constants.expoConfig?.extra?.pusherCluster || 'mt1';
```

**Criteri di accettazione:**
- [ ] API URL letto da `Constants.expoConfig.extra.apiUrl`
- [ ] Pusher key/cluster da environment
- [ ] Fallback ai valori di default se variabili non impostate
- [ ] App si avvia correttamente con `expo start`
- [ ] Nessun IP locale hardcoded nel codice

---

#### N1.2 — APP-005: Allineare Tema Colori (M, 3-8h)

**File da creare:** `mobile/src/theme/theme.ts`
**File da modificare:** Tutti gli screen esistenti, `mobile/App.tsx`, `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
1. Creare il file tema centralizzato:
```typescript
// mobile/src/theme/theme.ts

export const colors = {
  // Sfondo e superfici
  body: '#0a0a0b',
  card: '#1a1c20',
  surface: '#252830',
  surfaceLight: '#2d3139',

  // Primari
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: '#3b82f6' + '20',

  // Semantici
  secondary: '#22c55e',
  accent: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',

  // Testo
  text: '#f3f4f6',
  textSecondary: '#9ca3af',
  dim: '#6b7280',

  // Bordi
  border: 'rgba(42,49,66,0.2)',
  borderSolid: '#2a3142',

  // Posizioni giocatori
  position: {
    P: { bg: '#f59e0b', text: '#000000' },
    D: { bg: '#3b82f6', text: '#ffffff' },
    C: { bg: '#22c55e', text: '#ffffff' },
    A: { bg: '#ef4444', text: '#ffffff' },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 26,
  display: 32,
} as const;

// Tema per React Navigation
export const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.body,
    card: colors.card,
    text: colors.text,
    border: colors.borderSolid,
    notification: colors.primary,
  },
};
```

2. Aggiornare `mobile/App.tsx`:
```typescript
// PRIMA:
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

// DOPO:
import { navigationTheme } from '@/theme/theme';
// usare navigationTheme al posto di DarkTheme
```

3. Aggiornare `mobile/src/navigation/AppNavigator.tsx`:
```typescript
// PRIMA:
const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  primary: '#6366F1',
  ...
};

// DOPO:
import { colors } from '@/theme/theme';
// Sostituire ogni riferimento a COLORS.xxx con colors.xxx
// Mappare: COLORS.background → colors.body, COLORS.card → colors.card, etc.
```

4. Aggiornare ogni screen (`HomeScreen.tsx`, `RosterScreen.tsx`, `ContractsScreen.tsx`, `LoginScreen.tsx`, `LeagueSelectionScreen.tsx`, e tutti gli stub):
   - Rimuovere la costante `COLORS` locale
   - Importare `import { colors } from '@/theme/theme';`
   - Sostituire ogni occorrenza: `COLORS.background` → `colors.body`, `COLORS.card` → `colors.card`, `COLORS.primary` → `colors.primary`, etc.

5. Aggiornare `mobile/app.json`: splash background da `#1a1a2e` a `#0a0a0b`

**Criteri di accettazione:**
- [ ] File `theme.ts` creato con tutti i colori allineati alla web app
- [ ] Nessuno screen contiene una costante `COLORS` locale
- [ ] Tutti gli screen importano da `@/theme/theme`
- [ ] App.tsx usa `navigationTheme`
- [ ] Splash screen background aggiornato
- [ ] Aspetto visivo coerente con la web app (sfondo piu scuro, primary blu)

---

#### N1.3 — APP-006: Error Boundary (S, 1-3h)

**File da creare:** `mobile/src/components/ErrorBoundary.tsx`
**File da modificare:** `mobile/App.tsx`

**Cosa fare:**
1. Creare il componente Error Boundary:
```typescript
// mobile/src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '@/theme/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // Qui in futuro: invio a servizio analytics/crash reporting
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Ionicons name="bug-outline" size={72} color={colors.danger} />
          <Text style={styles.title}>Qualcosa e' andato storto</Text>
          <Text style={styles.subtitle}>
            Si e' verificato un errore imprevisto. Prova a ripetere l'operazione.
          </Text>
          {__DEV__ && this.state.error && (
            <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
              <Text style={styles.errorText}>{this.state.error.toString()}</Text>
            </ScrollView>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
            <Text style={styles.retryText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.body,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBox: {
    maxHeight: 120,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  errorBoxContent: {
    padding: spacing.md,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xxl,
    gap: 10,
  },
  retryText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
```

2. Wrappare l'app in `mobile/App.tsx`:
```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        {/* ... resto dell'app ... */}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
```

**Criteri di accettazione:**
- [ ] Crash non mostra schermata bianca ma UI di fallback
- [ ] Bottone "Riprova" resetta lo stato e ricarica i children
- [ ] In `__DEV__` mode: mostra stack trace dell'errore
- [ ] In produzione: mostra solo messaggio user-friendly
- [ ] `componentDidCatch` logga l'errore in console

---

#### N1.4 — APP-012: Skeleton Loading (M, 3-8h)

**File da creare:** `mobile/src/components/Skeleton.tsx`
**File da modificare:** `mobile/src/screens/home/HomeScreen.tsx`, `mobile/src/screens/roster/RosterScreen.tsx`

**Cosa fare:**
1. Creare il componente Skeleton con animazione shimmer:
```typescript
// mobile/src/components/Skeleton.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius } from '@/theme/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius: br = borderRadius.md,
  style,
}: SkeletonProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: br,
          backgroundColor: colors.surface,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ---- Varianti predefinite ----

export function SkeletonCard(): React.JSX.Element {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.cardHeader}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <View style={skeletonStyles.cardHeaderText}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <Skeleton width="100%" height={1} style={{ marginVertical: 12 }} />
      <View style={skeletonStyles.cardRow}>
        <Skeleton width="30%" height={14} />
        <Skeleton width="30%" height={14} />
        <Skeleton width="30%" height={14} />
      </View>
    </View>
  );
}

export function SkeletonPlayerCard(): React.JSX.Element {
  return (
    <View style={skeletonStyles.playerCard}>
      <View style={skeletonStyles.cardHeader}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <View style={skeletonStyles.cardHeaderText}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="35%" height={12} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={40} height={24} borderRadius={6} />
      </View>
      <View style={skeletonStyles.contractRow}>
        <Skeleton width="28%" height={32} borderRadius={6} />
        <Skeleton width="28%" height={32} borderRadius={6} />
        <Skeleton width="28%" height={32} borderRadius={6} />
      </View>
    </View>
  );
}

export function SkeletonStatGrid(): React.JSX.Element {
  return (
    <View style={skeletonStyles.statGrid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={skeletonStyles.statItem}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <Skeleton width={40} height={20} style={{ marginTop: 8 }} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }): React.JSX.Element {
  return (
    <View style={skeletonStyles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={skeletonStyles.listItem}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 12,
  },
  contractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 14,
    alignItems: 'center',
  },
  list: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 14,
  },
});
```

2. Usare in `HomeScreen.tsx`:
```typescript
import { SkeletonStatGrid, SkeletonCard } from '@/components/Skeleton';

// Nella funzione LoadingState:
function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Skeleton width="50%" height={26} style={{ marginBottom: 8 }} />
        <Skeleton width="30%" height={16} style={{ marginBottom: 20 }} />
        <SkeletonCard />
        <Skeleton width="30%" height={18} style={{ marginBottom: 14 }} />
        <SkeletonStatGrid />
      </View>
    </View>
  );
}
```

3. Usare in `RosterScreen.tsx`:
```typescript
import { SkeletonPlayerCard } from '@/components/Skeleton';

// Nella funzione LoadingState:
function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={{ padding: 16 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonPlayerCard key={i} />
        ))}
      </View>
    </View>
  );
}
```

**Criteri di accettazione:**
- [ ] Componente `Skeleton` con animazione shimmer (opacity pulse)
- [ ] Varianti: `SkeletonCard`, `SkeletonPlayerCard`, `SkeletonStatGrid`, `SkeletonList`
- [ ] `HomeScreen` mostra skeleton durante caricamento
- [ ] `RosterScreen` mostra skeleton durante caricamento
- [ ] Animazione fluida senza jank (useNativeDriver: true)

---

#### N1.5 — APP-013: Pull-to-Refresh Sistematico (S, 1-3h)

**File da modificare:** `mobile/src/screens/contracts/ContractsScreen.tsx`, tutti gli stub screen che verranno implementati nei prossimi sprint

**Nota:** HomeScreen e RosterScreen hanno gia il pull-to-refresh. Verificare che ContractsScreen lo abbia. Questa task stabilisce il pattern per tutti i futuri screen.

**Cosa fare:**
1. Verificare `ContractsScreen.tsx` — se non ha `RefreshControl`, aggiungerlo:
```typescript
import { RefreshControl } from 'react-native';
import { colors } from '@/theme/theme';

// Nello screen:
const [refreshing, setRefreshing] = useState(false);

const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await fetchData();
  } finally {
    setRefreshing(false);
  }
}, [fetchData]);

// Nel FlatList o ScrollView:
<FlatList
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.card}
    />
  }
  ...
/>
```

2. Creare un hook riusabile:
```typescript
// mobile/src/hooks/useRefresh.ts
import { useState, useCallback } from 'react';

export function useRefresh(fetchFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFn();
    } finally {
      setRefreshing(false);
    }
  }, [fetchFn]);

  return { refreshing, onRefresh };
}
```

**Criteri di accettazione:**
- [ ] Hook `useRefresh` creato e riusabile
- [ ] `ContractsScreen` ha pull-to-refresh
- [ ] Colori del RefreshControl usano il tema
- [ ] Pattern documentato per i futuri screen

---

#### N1.6 — APP-007: Registration Screen (M, 3-8h)

**File da creare:** `mobile/src/screens/auth/RegisterScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`, `mobile/src/store/AuthContext.tsx`

**Cosa fare:**
1. Aggiungere `RegisterScreen` all'`AuthStack` in `AppNavigator.tsx`:
```typescript
// In AuthStackParamList:
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// In AuthStackNavigator:
import RegisterScreen from '@/screens/auth/RegisterScreen';

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}
```

2. Creare `RegisterScreen.tsx`:
```typescript
// mobile/src/screens/auth/RegisterScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '@/theme/theme';
import { useAuth } from '@/store/AuthContext';
import { AuthStackParamList } from '@/navigation/AppNavigator';

type RegisterNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen(): React.JSX.Element {
  const navigation = useNavigation<RegisterNavigationProp>();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = 'Email obbligatoria';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email non valida';
    if (!username.trim()) newErrors.username = 'Username obbligatorio';
    else if (username.length < 3) newErrors.username = 'Minimo 3 caratteri';
    if (!password) newErrors.password = 'Password obbligatoria';
    else if (password.length < 6) newErrors.password = 'Minimo 6 caratteri';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Le password non coincidono';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (): Promise<void> => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await register({ email: email.trim(), username: username.trim(), password });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore durante la registrazione';
      Alert.alert('Errore', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="trophy" size={48} color={colors.primary} />
          <Text style={styles.title}>Crea Account</Text>
          <Text style={styles.subtitle}>Registrati per iniziare a giocare</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputContainer, errors.email && styles.inputError]}>
              <Ionicons name="mail-outline" size={20} color={colors.dim} />
              <TextInput
                style={styles.input}
                placeholder="nome@email.com"
                placeholderTextColor={colors.dim}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputContainer, errors.username && styles.inputError]}>
              <Ionicons name="person-outline" size={20} color={colors.dim} />
              <TextInput
                style={styles.input}
                placeholder="Il tuo username"
                placeholderTextColor={colors.dim}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                enterKeyHint="next"
              />
            </View>
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, errors.password && styles.inputError]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.dim} />
              <TextInput
                style={styles.input}
                placeholder="Minimo 6 caratteri"
                placeholderTextColor={colors.dim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                enterKeyHint="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.dim}
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Conferma Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Conferma Password</Text>
            <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.dim} />
              <TextInput
                style={styles.input}
                placeholder="Ripeti la password"
                placeholderTextColor={colors.dim}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                enterKeyHint="done"
                onSubmitEditing={handleRegister}
              />
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>
        </View>

        {/* Bottone Registrazione */}
        <TouchableOpacity
          style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.registerButtonText}>Registrati</Text>
          )}
        </TouchableOpacity>

        {/* Link Login */}
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.loginLinkText}>
            Hai gia un account? <Text style={styles.loginLinkTextBold}>Accedi</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.body },
  scrollContent: { flexGrow: 1, padding: spacing.xxl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxxl },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.sm },
  form: { gap: spacing.lg },
  inputGroup: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, height: 52,
    borderWidth: 1, borderColor: colors.borderSolid, gap: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, fontSize: fontSize.lg, color: colors.text },
  errorText: { fontSize: fontSize.xs, color: colors.danger },
  registerButton: {
    backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl,
  },
  registerButtonDisabled: { opacity: 0.6 },
  registerButtonText: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.md },
  loginLinkText: { fontSize: fontSize.md, color: colors.textSecondary },
  loginLinkTextBold: { color: colors.primary, fontWeight: '600' },
});
```

3. Aggiungere funzione `register` all'`AuthContext.tsx` se non presente:
```typescript
// In AuthContext:
const register = async (data: RegisterData): Promise<void> => {
  const response = await authApi.register(data);
  if (response.success && response.data) {
    await SecureStore.setItemAsync(TOKEN_KEY, response.data.token);
    dispatch({ type: 'LOGIN', payload: response.data.user });
  } else {
    throw new Error(response.message || 'Registrazione fallita');
  }
};
```

4. Aggiungere link "Registrati" nella `LoginScreen.tsx` in basso:
```typescript
<TouchableOpacity onPress={() => navigation.navigate('Register')}>
  <Text style={styles.registerLinkText}>
    Non hai un account? <Text style={{ color: colors.primary, fontWeight: '600' }}>Registrati</Text>
  </Text>
</TouchableOpacity>
```

**Criteri di accettazione:**
- [ ] Form con 4 campi: email, username, password, conferma password
- [ ] Validazione client-side con messaggi di errore sotto ogni campo
- [ ] Keyboard avoiding view su iOS
- [ ] Input types corretti (email, new-password, etc.)
- [ ] Toggle visibilita password
- [ ] Loading state durante la richiesta
- [ ] Navigazione bidirezionale Login <-> Register
- [ ] Dopo registrazione: utente autenticato automaticamente

---

### Chiusura Sprint N1
```bash
npm run lint     # (se configurato)
# Verificare che l'app si avvii senza errori
npx expo start
git add .
git commit -m "feat(mobile): Sprint N1 - Foundation (APP-004..APP-007, APP-012, APP-013)"
git push origin MOBILE-ANDROID
```

---

## SPRINT N2 — Asta (~2 settimane, 3 task)

### Setup
```bash
git checkout MOBILE-ANDROID
git pull origin MOBILE-ANDROID
```

### Ordine di Implementazione
```
APP-001 (Asta Iniziale) → APP-002 (Asta Riparazione, riusa componenti)
APP-008 (Indennizzi/Rubata) — indipendente da APP-001
```

---

#### N2.1 — APP-001: InitialAuctionScreen — Asta Iniziale (XL, 1-2 settimane)

**File da modificare:** `mobile/src/screens/auctions/InitialAuctionScreen.tsx`
**File da creare:**
- `mobile/src/components/auction/PlayerAuctionCard.tsx`
- `mobile/src/components/auction/BidControls.tsx`
- `mobile/src/components/auction/AuctionTimer.tsx`
- `mobile/src/components/auction/BudgetBar.tsx`
- `mobile/src/components/auction/BidHistory.tsx`
- `mobile/src/hooks/useAuctionRealtime.ts`

**Cosa fare:**

1. Creare `PlayerAuctionCard.tsx` — card del giocatore attualmente in asta:
```typescript
// mobile/src/components/auction/PlayerAuctionCard.tsx
interface PlayerAuctionCardProps {
  player: SerieAPlayer;
  currentBid: number;
  highestBidder: string | null;
  isUserHighest: boolean;
}
// Card grande con:
// - Badge posizione (P/D/C/A) con colore tema
// - Nome giocatore (font grande, bold)
// - Squadra Serie A
// - Quotazione ufficiale
// - Prezzo attuale (grande, evidenziato)
// - Nome ultimo offerente
// - Indicatore se l'utente e' il migliore offerente (bordo verde / icona checkmark)
```

2. Creare `BidControls.tsx` — controlli per fare offerta:
```typescript
// mobile/src/components/auction/BidControls.tsx
interface BidControlsProps {
  currentBid: number;
  minIncrement: number;
  maxBid: number;
  onPlaceBid: (amount: number) => void;
  isDisabled: boolean;
  isUserHighest: boolean;
}
// - Stepper +/- per incrementare di 1M (con long press per 5M)
// - Display valore offerta corrente
// - Bottone "OFFRI" grande (minimo 52px altezza)
// - Colore: verde se puo offrire, grigio se disabilitato, giallo se gia il piu alto
// - Haptic feedback su pressione bottone OFFRI (Vibration.vibrate(50))
```

3. Creare `AuctionTimer.tsx` — countdown timer:
```typescript
// mobile/src/components/auction/AuctionTimer.tsx
interface AuctionTimerProps {
  expiresAt: string | null;
  totalSeconds: number;
}
// - Cerchio con countdown numerico al centro
// - Colori dinamici:
//   - > 30s: colors.secondary (verde)
//   - 10-30s: colors.accent (arancione)
//   - < 10s: colors.danger (rosso) + animazione pulse
// - Testo "TEMPO SCADUTO" quando arriva a 0
```

4. Creare `BudgetBar.tsx` — visualizzazione budget:
```typescript
// mobile/src/components/auction/BudgetBar.tsx
interface BudgetBarProps {
  budget: number;
  initialBudget: number;
  pendingBid: number;
}
// - Barra orizzontale con percentuale budget rimanente
// - Mostra: "Budget: 150M / 200M" e "Offerta corrente: 8M"
// - Colore barra: verde > 50%, arancione 20-50%, rosso < 20%
```

5. Creare `BidHistory.tsx` — storico offerte:
```typescript
// mobile/src/components/auction/BidHistory.tsx
interface BidHistoryProps {
  bids: AuctionBid[];
  currentUserId: string;
}
// - FlatList invertita (ultime offerte in cima)
// - Ogni riga: nome offerente, importo, timestamp relativo
// - Offerta dell'utente evidenziata con colore primary
```

6. Creare hook per real-time:
```typescript
// mobile/src/hooks/useAuctionRealtime.ts
import { useEffect, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import { pusherService, BidPlacedData, AuctionClosedData, TimerUpdateData } from '@/services/pusher';

interface UseAuctionRealtimeOptions {
  sessionId: string;
  currentMemberId: string;
  onBidPlaced: (data: BidPlacedData) => void;
  onAuctionClosed: (data: AuctionClosedData) => void;
  onTimerUpdate?: (data: TimerUpdateData) => void;
}

export function useAuctionRealtime(options: UseAuctionRealtimeOptions) {
  useEffect(() => {
    const unsubscribe = pusherService.subscribeToAuction(options.sessionId, {
      onBidPlaced: (data) => {
        // Haptic feedback: vibra se qualcuno supera l'offerta dell'utente
        if (data.memberId !== options.currentMemberId) {
          Vibration.vibrate(100); // outbid
        }
        options.onBidPlaced(data);
      },
      onAuctionClosed: (data) => {
        // Haptic feedback diverso per vittoria/sconfitta
        if (data.winnerId === options.currentMemberId) {
          Vibration.vibrate([0, 100, 50, 100]); // win pattern
        } else if (data.wasUnsold) {
          Vibration.vibrate(50); // unsold
        }
        options.onAuctionClosed(data);
      },
      onTimerUpdate: options.onTimerUpdate,
    });

    return unsubscribe;
  }, [options.sessionId]);
}
```

7. Implementare `InitialAuctionScreen.tsx`:
```typescript
// Layout schermata:
// ┌──────────────────────────┐
// │  AuctionTimer (in alto)  │
// ├──────────────────────────┤
// │  BudgetBar               │
// ├──────────────────────────┤
// │  PlayerAuctionCard       │
// │  (giocatore corrente)    │
// ├──────────────────────────┤
// │  BidControls             │
// ├──────────────────────────┤
// │  BidHistory (scrollable) │
// └──────────────────────────┘

// API calls necessarie:
// - GET /api/market-sessions/:sessionId/auctions/current
// - POST /api/auctions/:auctionId/bid { amount }
// - GET /api/market-sessions/:sessionId (per stato sessione)
```

**Criteri di accettazione:**
- [ ] Visualizzazione giocatore corrente in asta con tutti i dettagli
- [ ] Timer countdown real-time con colori dinamici
- [ ] Stepper +/- per impostare importo offerta
- [ ] Bottone OFFRI con feedback haptic
- [ ] Budget bar con percentuale rimanente
- [ ] Storico offerte aggiornato real-time via Pusher
- [ ] Vibrazione quando si viene superati da un'altra offerta
- [ ] Pattern vibrazione diverso su vittoria/sconfitta
- [ ] Gestione caso "nessuna asta attiva" con messaggio appropriato
- [ ] Loading state con Skeleton durante caricamento iniziale
- [ ] Pull-to-refresh per ricaricare lo stato

---

#### N2.2 — APP-002: RepairAuctionScreen — Asta Riparazione (L, 3-5 giorni)

**File da modificare:** `mobile/src/screens/auctions/RepairAuctionScreen.tsx`

**Cosa fare:**
Simile a `InitialAuctionScreen` ma con queste differenze:

1. Lista svincolati disponibili con filtri posizione (P/D/C/A)
2. Il manager seleziona un giocatore e lo nomina per l'asta
3. Riusa i componenti creati in APP-001: `PlayerAuctionCard`, `BidControls`, `AuctionTimer`, `BudgetBar`, `BidHistory`
4. Aggiungere componente lista svincolati:
```typescript
// Nella parte superiore dello screen:
// - Tabs filtro posizione (come RosterScreen)
// - FlatList orizzontale di giocatori svincolati
// - Tap su giocatore → lo seleziona per la nomina
// - Bottone "Nomina" per avviare l'asta su quel giocatore

// Nella parte inferiore:
// - Se un'asta e' in corso: PlayerAuctionCard + BidControls + Timer
// - Se nessuna asta: messaggio "In attesa di nomina..."
```

5. Gestire il turno di nomina:
```typescript
// - Mostrare "E' il tuo turno di nominare!" se e' il turno dell'utente
// - Mostrare "Turno di: [nome manager]" se e' il turno di un altro
// - Disabilitare la nomina se non e' il proprio turno
```

**Criteri di accettazione:**
- [ ] Lista svincolati con filtro posizione
- [ ] Nomina giocatore funzionale (solo nel proprio turno)
- [ ] Asta con stessi controlli di InitialAuction
- [ ] Indicazione turno corrente
- [ ] Real-time updates via Pusher (nomination-confirmed, bid-placed, auction-closed)
- [ ] Haptic feedback come in InitialAuction

---

#### N2.3 — APP-008: IndemnityScreen — Indennizzi e Rubata (L, 3-5 giorni)

**File da modificare:** `mobile/src/screens/auctions/IndemnityScreen.tsx`
**File da creare:** `mobile/src/components/auction/IndemnityBoard.tsx`

**Cosa fare:**
1. Creare il board degli indennizzi:
```typescript
// mobile/src/components/auction/IndemnityBoard.tsx
interface IndemnityBoardProps {
  players: Array<{
    roster: PlayerRoster;
    decision: 'KEEP' | 'RELEASE' | null;
  }>;
  onDecision: (rosterId: string, decision: 'KEEP' | 'RELEASE') => void;
  isSubmitted: boolean;
}
// - Lista giocatori con clausola attivata (contratto scaduto o giocatore uscito)
// - Per ogni giocatore:
//   - Card con nome, posizione, squadra, clausola rescissione
//   - Due bottoni: "Tieni" (verde) / "Rilascia" (rosso)
//   - Visualizzazione costo: "Paghi: XM" per tieni, "Incassi: YM" per rilascia
// - Riepilogo in basso: budget dopo decisioni
```

2. Implementare `IndemnityScreen.tsx`:
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Header: Fase e Timer    │
// ├──────────────────────────┤
// │  Riepilogo Budget        │
// ├──────────────────────────┤
// │  Lista Giocatori         │
// │  (keep/release toggle)   │
// ├──────────────────────────┤
// │  Bottone "Conferma"      │
// └──────────────────────────┘

// API calls:
// - GET /api/market-sessions/:sessionId/indemnity (giocatori con clausola)
// - POST /api/market-sessions/:sessionId/indemnity { decisions: [{ rosterId, decision }] }
```

3. Real-time: Pusher events `indemnity-decision-submitted` e `indemnity-all-decided`
4. Stato "In attesa degli altri manager" dopo conferma

**Criteri di accettazione:**
- [ ] Lista giocatori con clausola attivata
- [ ] Toggle TIENI/RILASCIA per ogni giocatore
- [ ] Visualizzazione costo/incasso per ogni decisione
- [ ] Riepilogo budget aggiornato in tempo reale
- [ ] Bottone conferma con dialog di conferma
- [ ] Stato "in attesa" dopo invio decisioni
- [ ] Real-time: notifica quando tutti hanno deciso
- [ ] Haptic feedback su conferma

---

### Chiusura Sprint N2
```bash
npx expo start   # Verificare funzionamento
git add .
git commit -m "feat(mobile): Sprint N2 - Asta Iniziale, Riparazione, Indennizzi (APP-001, APP-002, APP-008)"
git push origin MOBILE-ANDROID
```

---

## SPRINT N3 — Scambi + Profilo (~2 settimane, 4 task)

### Setup
```bash
git checkout MOBILE-ANDROID
git pull origin MOBILE-ANDROID
```

### Ordine
```
APP-003 (Scambi) — task piu grande, iniziare per primo
APP-009 (Profilo), APP-010 (Impostazioni), APP-011 (Storico) — indipendenti
```

---

#### N3.1 — APP-003: Scambi — TradesScreen + CreateTradeScreen + TradeDetailScreen (XL, 1 settimana)

**File da modificare:**
- `mobile/src/screens/trades/TradesScreen.tsx`
- `mobile/src/screens/trades/CreateTradeScreen.tsx`
- `mobile/src/screens/trades/TradeDetailScreen.tsx`

**File da creare:**
- `mobile/src/components/trades/TradeCard.tsx`
- `mobile/src/components/trades/PlayerSelector.tsx`
- `mobile/src/components/trades/TradeComparison.tsx`

**Cosa fare:**

1. **TradesScreen.tsx** — Lista scambi:
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Tabs: Ricevuti | Inviati│
// ├──────────────────────────┤
// │  Lista TradeCard          │
// │  (FlatList con pull-to-  │
// │   refresh)               │
// ├──────────────────────────┤
// │  FAB: "Nuovo Scambio"   │
// └──────────────────────────┘

// Ogni TradeCard mostra:
// - Controparte (nome, team name)
// - Stato con colore (pending: arancio, accepted: verde, rejected: rosso)
// - Numero giocatori offerti/richiesti: "2 → 1 + 5M"
// - Data proposta
// - Tap → naviga a TradeDetailScreen

// API: GET /api/leagues/:leagueId/trades
```

2. **CreateTradeScreen.tsx** — Creazione scambio:
```typescript
// Flow multi-step:
// Step 1: Seleziona controparte (lista membri lega)
// Step 2: Seleziona giocatori da offrire (dalla propria rosa)
// Step 3: Seleziona giocatori da richiedere (dalla rosa avversaria)
// Step 4: Budget aggiuntivo opzionale (stepper +/-)
// Step 5: Messaggio opzionale (TextInput multiline)
// Step 6: Riepilogo e conferma

// Componente PlayerSelector:
// - FlatList con ricerca
// - Filtro posizione
// - Checkbox per selezione multipla
// - Preview giocatori selezionati in basso

// API:
// - GET /api/leagues/:leagueId/members (lista membri)
// - GET /api/leagues/:leagueId/members/:memberId/roster (rosa avversario)
// - POST /api/leagues/:leagueId/trades (crea scambio)
```

3. **TradeDetailScreen.tsx** — Dettaglio scambio:
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Header: stato + data    │
// ├──────────────────────────┤
// │  TradeComparison         │
// │  (giocatori offerti vs   │
// │   giocatori richiesti)   │
// ├──────────────────────────┤
// │  Budget: +5M → / ← -3M  │
// ├──────────────────────────┤
// │  Messaggio (se presente) │
// ├──────────────────────────┤
// │  Azioni:                 │
// │  Accetta | Rifiuta       │
// │  (solo se ricevuto e     │
// │   pending)               │
// └──────────────────────────┘

// TradeComparison:
// - Due colonne: "Offri" e "Ricevi"
// - Ogni giocatore con card: posizione, nome, squadra, quotazione
// - Totale valore per colonna

// API:
// - GET /api/trades/:tradeId
// - POST /api/trades/:tradeId/respond { action: 'accept' | 'reject' }
```

4. Real-time via Pusher: `trade-offer-received`, `trade-offer-responded`
5. Notifica push locale quando si riceve un nuovo scambio

**Criteri di accettazione:**
- [ ] Lista scambi con tabs Ricevuti/Inviati
- [ ] TradeCard con stato colorato e riepilogo
- [ ] Creazione scambio multi-step funzionale
- [ ] Selezione giocatori con filtri e ricerca
- [ ] Dettaglio scambio con confronto visivo
- [ ] Accetta/Rifiuta con dialog di conferma
- [ ] Real-time: nuovi scambi appaiono senza refresh
- [ ] FAB "Nuovo Scambio" visibile
- [ ] Pull-to-refresh sulla lista

---

#### N3.2 — APP-009: ProfileScreen — Profilo Utente (M, 3-5 giorni)

**File da modificare:** `mobile/src/screens/more/ProfileScreen.tsx`

**Cosa fare:**
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Avatar (tap per cambiare│
// │  con camera/galleria)    │
// │  Username                │
// │  Email                   │
// ├──────────────────────────┤
// │  Sezione: Info Personali │
// │  - Username (editabile)  │
// │  - Email (readonly)      │
// ├──────────────────────────┤
// │  Sezione: Cambio Password│
// │  - Password attuale      │
// │  - Nuova password        │
// │  - Conferma password     │
// │  - Bottone "Aggiorna"    │
// ├──────────────────────────┤
// │  Sezione: Statistiche    │
// │  - Leghe partecipate     │
// │  - Data registrazione    │
// └──────────────────────────┘

// Per la foto:
import * as ImagePicker from 'expo-image-picker';
// Richiede: expo-image-picker (gia incluso in Expo SDK 52)

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (!result.canceled) {
    // Upload via FormData
    const formData = new FormData();
    formData.append('photo', {
      uri: result.assets[0].uri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    } as unknown as Blob);
    await profileApi.uploadPhoto(formData);
  }
};

// API:
// - GET /api/users/me
// - PUT /api/users/me { username }
// - PUT /api/users/me/password { currentPassword, newPassword }
// - POST /api/users/me/photo (FormData)
```

**Nota:** `expo-image-picker` e' gia incluso in Expo SDK 52, non richiede installazione separata.

**Criteri di accettazione:**
- [ ] Visualizzazione profilo con avatar, username, email
- [ ] Tap su avatar apre scelta camera/galleria
- [ ] Modifica username con salvataggio
- [ ] Cambio password con validazione
- [ ] Statistiche utente (leghe, data registrazione)
- [ ] Loading state durante salvataggio
- [ ] Messaggi di successo/errore

---

#### N3.3 — APP-010: SettingsScreen — Impostazioni (M, 2-3 giorni)

**File da modificare:** `mobile/src/screens/more/SettingsScreen.tsx`

**Cosa fare:**
```typescript
// Layout a sezioni con toggle:
// ┌──────────────────────────┐
// │  Sezione: Notifiche      │
// │  - Push notifications [T]│
// │  - Suoni [T]             │
// │  - Vibrazione [T]        │
// ├──────────────────────────┤
// │  Sezione: Aspetto        │
// │  - Tema: Scuro (fisso)   │
// ├──────────────────────────┤
// │  Sezione: Dati           │
// │  - Svuota cache [BTN]    │
// │  - Dimensione cache      │
// ├──────────────────────────┤
// │  Sezione: Info           │
// │  - Versione app          │
// │  - Build number          │
// │  - Licenze open source   │
// ├──────────────────────────┤
// │  Logout [BTN rosso]      │
// └──────────────────────────┘

// Per le preferenze: usare AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app_settings';

interface AppSettings {
  pushNotifications: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

// Per la cache:
const clearCache = async () => {
  await AsyncStorage.clear();
  // Re-salvare il token di auth
  Alert.alert('Cache svuotata', 'La cache e\' stata svuotata con successo.');
};

// Versione:
import Constants from 'expo-constants';
const version = Constants.expoConfig?.version || '1.0.0';
```

**Criteri di accettazione:**
- [ ] Toggle notifiche push, suoni, vibrazione
- [ ] Preferenze salvate in AsyncStorage e persistenti
- [ ] Svuota cache con conferma dialog
- [ ] Visualizzazione versione app e build number
- [ ] Bottone Logout con conferma
- [ ] UI coerente con il tema (sezioni con card)

---

#### N3.4 — APP-011: HistoryScreen — Storico Movimenti (M, 2-3 giorni)

**File da modificare:** `mobile/src/screens/more/HistoryScreen.tsx`

**Cosa fare:**
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Filtri:                 │
// │  [Tipo v] [Da] [A]      │
// ├──────────────────────────┤
// │  Timeline movimenti      │
// │  (FlatList con sezioni   │
// │   per data)              │
// └──────────────────────────┘

// Ogni movimento nella timeline:
// - Icona tipo (acquisto: carrello, scambio: frecce, rilascio: X, rinnovo: documento)
// - Titolo: "Acquistato Barella" / "Scambio: Lautaro <-> Vlahovic"
// - Dettagli: prezzo, da/a, salario
// - Timestamp relativo

// Tipi movimento con icone:
const MOVEMENT_ICONS: Record<MovementType, { icon: string; color: string }> = {
  FIRST_MARKET: { icon: 'cart', color: colors.primary },
  TRADE: { icon: 'swap-horizontal', color: colors.accent },
  RUBATA: { icon: 'flash', color: colors.danger },
  SVINCOLATI: { icon: 'person-add', color: colors.secondary },
  RELEASE: { icon: 'person-remove', color: colors.dim },
  CONTRACT_RENEW: { icon: 'document-text', color: colors.info },
  // ... etc.
};

// API:
// - GET /api/leagues/:leagueId/movements?type=&from=&to=&page=&limit=
```

**Criteri di accettazione:**
- [ ] Timeline movimenti con icone per tipo
- [ ] Filtro per tipo movimento
- [ ] Filtro per data (da/a)
- [ ] Paginazione infinita (FlatList onEndReached)
- [ ] Sezioni raggruppate per data
- [ ] Pull-to-refresh
- [ ] Stato vuoto se nessun movimento

---

### Chiusura Sprint N3
```bash
npx expo start
git add .
git commit -m "feat(mobile): Sprint N3 - Scambi, Profilo, Impostazioni, Storico (APP-003, APP-009..APP-011)"
git push origin MOBILE-ANDROID
```

---

## SPRINT N4 — Schermate Mancanti (~2 settimane, 6 task)

### Setup
```bash
git checkout MOBILE-ANDROID
git pull origin MOBILE-ANDROID
```

### Ordine
Tutte indipendenti tra loro. Iniziare da APP-020 (AllPlayers) perche e' la piu riusabile.

---

#### N4.1 — APP-020: AllPlayersScreen — Tutti i Giocatori (M, 2-3 giorni)

**File da creare:** `mobile/src/screens/players/AllPlayersScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
```typescript
// Aggiungere nella navigazione (MoreStack o nuovo PlayersStack)
// Screen accessibile da MoreScreen e da HomeScreen

// Layout:
// ┌──────────────────────────┐
// │  Barra ricerca           │
// ├──────────────────────────┤
// │  Filtri posizione (tabs) │
// ├──────────────────────────┤
// │  FlatList giocatori      │
// │  (PlayerCard con nome,   │
// │   squadra, posizione,    │
// │   quotazione, stato)     │
// └──────────────────────────┘

// - Ricerca per nome (debounced 300ms)
// - Filtro posizione (P/D/C/A/Tutti)
// - Filtro squadra (picker opzionale)
// - Ordinamento per: nome, quotazione, squadra
// - Paginazione infinita
// - Tap su giocatore → PlayerStatsScreen

// API: GET /api/leagues/:leagueId/players?search=&position=&team=&page=&limit=&sort=
```

**Criteri di accettazione:**
- [ ] Lista completa giocatori con ricerca
- [ ] Filtri posizione e ordinamento
- [ ] Paginazione infinita
- [ ] Tap su giocatore naviga a dettaglio
- [ ] Pull-to-refresh
- [ ] Skeleton loading

---

#### N4.2 — APP-019: PlayerStatsScreen — Statistiche Giocatore (M, 2-3 giorni)

**File da creare:** `mobile/src/screens/players/PlayerStatsScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Header giocatore        │
// │  (posizione, nome,       │
// │   squadra, quotazione)   │
// ├──────────────────────────┤
// │  Sezione: Contratto      │
// │  (proprietario, salario, │
// │   durata, clausola)      │
// ├──────────────────────────┤
// │  Sezione: Storico Aste   │
// │  (lista aste passate per │
// │   questo giocatore)      │
// ├──────────────────────────┤
// │  Sezione: Movimenti      │
// │  (timeline movimenti)    │
// └──────────────────────────┘

// API:
// - GET /api/players/:playerId
// - GET /api/players/:playerId/history (movimenti e aste)
```

**Criteri di accettazione:**
- [ ] Header con info giocatore completa
- [ ] Sezione contratto (o "Svincolato" se non ha proprietario)
- [ ] Storico aste passate
- [ ] Timeline movimenti
- [ ] Pull-to-refresh

---

#### N4.3 — APP-015: LeagueDetailScreen — Dettaglio Lega (M, 2-3 giorni)

**File da creare:** `mobile/src/screens/league/LeagueDetailScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Header: nome lega,      │
// │  stato, fase corrente    │
// ├──────────────────────────┤
// │  Tabs: Membri | Config   │
// ├──────────────────────────┤
// │  Tab Membri:             │
// │  Lista con avatar, nome, │
// │  team, budget, n.rosa    │
// ├──────────────────────────┤
// │  Tab Config:             │
// │  Budget iniziale, slot   │
// │  per ruolo, regole       │
// └──────────────────────────┘

// API: GET /api/leagues/:leagueId (con ?include=members)
```

**Criteri di accettazione:**
- [ ] Header lega con stato e fase
- [ ] Tab Membri con lista completa
- [ ] Tab Configurazione con regole lega
- [ ] Tap su membro → visualizza la sua rosa (navigazione a RosterScreen filtrato)

---

#### N4.4 — APP-016: FinancialsScreen — Finanze Lega (L, 3-5 giorni)

**File da creare:** `mobile/src/screens/league/FinancialsScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Header: Tabellone       │
// ├──────────────────────────┤
// │  Tabella riepilogo per   │
// │  manager:                │
// │  - Budget iniziale       │
// │  - Speso aste            │
// │  - Stipendi totali       │
// │  - Clausole              │
// │  - Budget rimanente      │
// ├──────────────────────────┤
// │  Ordinamento per colonna │
// └──────────────────────────┘

// Su mobile: card scrollabili orizzontalmente (visto che una tabella non sta)
// Ogni card = 1 manager con tutti i dati finanziari

// Alternativa: ScrollView orizzontale con tabella
// <ScrollView horizontal>
//   <Table ... />
// </ScrollView>

// API: GET /api/leagues/:leagueId/financials
```

**Criteri di accettazione:**
- [ ] Tabellone finanze per tutti i manager
- [ ] Visualizzazione adatta a mobile (card o scroll orizzontale)
- [ ] Ordinamento per colonna
- [ ] Pull-to-refresh

---

#### N4.5 — APP-021: MovementsScreen — Movimenti Lega (M, 2 giorni)

**File da creare:** `mobile/src/screens/league/MovementsScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`

**Nota:** Simile a `HistoryScreen` (APP-011) ma mostra i movimenti di TUTTA la lega, non solo dell'utente corrente.

**Cosa fare:**
```typescript
// Riusare la struttura di HistoryScreen ma con:
// - Filtro per manager (oltre a tipo e data)
// - Ogni movimento mostra chi ha fatto l'operazione
// - API: GET /api/leagues/:leagueId/movements (senza filtro membro)
```

**Criteri di accettazione:**
- [ ] Timeline movimenti di tutta la lega
- [ ] Filtro per tipo, data, manager
- [ ] Paginazione infinita
- [ ] Pull-to-refresh

---

#### N4.6 — APP-022: NotificationsScreen — Centro Notifiche (S, 1-2 giorni)

**File da creare:** `mobile/src/screens/notifications/NotificationsScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
```typescript
// Layout:
// ┌──────────────────────────┐
// │  Header: Notifiche       │
// │  "Segna tutte come lette"│
// ├──────────────────────────┤
// │  FlatList notifiche      │
// │  (raggruppate per oggi / │
// │   ieri / precedenti)     │
// └──────────────────────────┘

// Ogni notifica:
// - Icona tipo (asta, scambio, contratto, sistema)
// - Testo descrittivo
// - Timestamp relativo
// - Indicatore non letta (pallino blu)
// - Tap → naviga allo screen pertinente

// Da NotificationContext: leggere le notifiche
// API: GET /api/notifications?page=&limit=
// API: PUT /api/notifications/read-all
```

**Criteri di accettazione:**
- [ ] Lista notifiche con raggruppamento temporale
- [ ] Indicatore non letta
- [ ] "Segna tutte come lette"
- [ ] Tap su notifica naviga al contesto
- [ ] Pull-to-refresh
- [ ] Badge contatore nell'header o bottom tab

---

### Chiusura Sprint N4
```bash
npx expo start
git add .
git commit -m "feat(mobile): Sprint N4 - Schermate mancanti (APP-015, APP-016, APP-019..APP-022)"
git push origin MOBILE-ANDROID
```

---

## SPRINT N5 — Polish (~2 settimane, 5 task)

### Setup
```bash
git checkout MOBILE-ANDROID
git pull origin MOBILE-ANDROID
```

---

#### N5.1 — APP-014: Autenticazione Biometrica (M, 2-3 giorni)

**File da creare:** `mobile/src/services/biometrics.ts`
**File da modificare:** `mobile/src/screens/auth/LoginScreen.tsx`, `mobile/src/screens/more/SettingsScreen.tsx`

**Cosa fare:**
```typescript
// mobile/src/services/biometrics.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_TOKEN_KEY = 'biometric_auth_token';

export const biometricService = {
  isAvailable: async (): Promise<boolean> => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  },

  getAuthTypes: async (): Promise<LocalAuthentication.AuthenticationType[]> => {
    return LocalAuthentication.supportedAuthenticationTypesAsync();
  },

  authenticate: async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Accedi a Fantacontratti',
      cancelLabel: 'Annulla',
      disableDeviceFallback: false,
    });
    return result.success;
  },

  enable: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  },

  disable: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
  },

  isEnabled: async (): Promise<boolean> => {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  },

  getStoredToken: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  },
};
```

**Nota:** `expo-local-authentication` e' gia incluso in Expo SDK 52.

**Modifica LoginScreen.tsx:**
```typescript
// Al mount:
useEffect(() => {
  const checkBiometric = async () => {
    const available = await biometricService.isAvailable();
    const enabled = await biometricService.isEnabled();
    if (available && enabled) {
      const success = await biometricService.authenticate();
      if (success) {
        const token = await biometricService.getStoredToken();
        if (token) {
          await loginWithToken(token);
        }
      }
    }
  };
  checkBiometric();
}, []);

// Mostrare bottone biometrico sotto il form:
{biometricAvailable && (
  <TouchableOpacity onPress={handleBiometricLogin} style={styles.biometricButton}>
    <Ionicons name="finger-print-outline" size={32} color={colors.primary} />
    <Text style={styles.biometricText}>Accedi con biometria</Text>
  </TouchableOpacity>
)}
```

**Modifica SettingsScreen.tsx:**
```typescript
// Toggle nella sezione Sicurezza:
// "Accesso biometrico" [Switch]
// Attivazione: richiede autenticazione biometrica + salva token
```

**Criteri di accettazione:**
- [ ] Rilevamento FaceID/Touch ID/Fingerprint disponibile
- [ ] Toggle attivazione in Impostazioni
- [ ] Login automatico con biometria al lancio app
- [ ] Bottone biometrico nella LoginScreen
- [ ] Fallback a login tradizionale se biometria fallisce

---

#### N5.2 — APP-017: Deep Linking (M, 2-3 giorni)

**File da modificare:** `mobile/app.json` (o `app.config.js`), `mobile/src/navigation/AppNavigator.tsx`

**Cosa fare:**
```typescript
// In app.config.js, aggiungere scheme:
// (gia presente: "scheme": "fantacontratti")

// In AppNavigator.tsx, configurare il linking:
import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'fantacontratti://'],
  config: {
    screens: {
      Main: {
        screens: {
          HomeTab: {
            screens: {
              Home: 'home',
              LeagueSelection: 'leagues',
            },
          },
          RosaTab: {
            screens: {
              Roster: 'roster',
            },
          },
          MercatoTab: {
            screens: {
              Auctions: 'auctions',
              AuctionDetail: 'auctions/:auctionId',
            },
          },
          ScambiTab: {
            screens: {
              Trades: 'trades',
              TradeDetail: 'trades/:tradeId',
            },
          },
          AltroTab: {
            screens: {
              Profile: 'profile',
              Settings: 'settings',
            },
          },
        },
      },
    },
  },
};

// In NavigationContainer:
<NavigationContainer theme={navigationTheme} linking={linking}>
  ...
</NavigationContainer>
```

**Criteri di accettazione:**
- [ ] `fantacontratti://home` apre la home
- [ ] `fantacontratti://auctions/:id` apre il dettaglio asta
- [ ] `fantacontratti://trades/:id` apre il dettaglio scambio
- [ ] Link funzionano sia da chiusa che da aperta
- [ ] Gestione caso utente non autenticato (redirect a login)

---

#### N5.3 — APP-018: Offline Mode (L, 3-5 giorni)

**File da creare:**
- `mobile/src/services/offlineStorage.ts`
- `mobile/src/hooks/useOfflineData.ts`
- `mobile/src/components/OfflineBanner.tsx`

**Cosa fare:**
```typescript
// mobile/src/services/offlineStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// Nota: @react-native-community/netinfo potrebbe richiedere installazione

const CACHE_PREFIX = 'offline_cache_';
const CACHE_TTL = 15 * 60 * 1000; // 15 minuti

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const offlineStorage = {
  set: async <T>(key: string, data: T): Promise<void> => {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  },

  get: async <T>(key: string): Promise<T | null> => {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry.data;
  },

  isOnline: async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  },
};

// mobile/src/hooks/useOfflineData.ts
export function useOfflineData<T>(key: string, fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const online = await offlineStorage.isOnline();
      setIsOffline(!online);

      if (online) {
        try {
          const freshData = await fetchFn();
          setData(freshData);
          await offlineStorage.set(key, freshData);
        } catch {
          const cached = await offlineStorage.get<T>(key);
          if (cached) setData(cached);
        }
      } else {
        const cached = await offlineStorage.get<T>(key);
        if (cached) setData(cached);
      }
      setIsLoading(false);
    };
    loadData();
  }, [key]);

  return { data, isOffline, isLoading };
}

// mobile/src/components/OfflineBanner.tsx
// Banner in cima allo screen: "Sei offline. Dati aggiornati a: 14:30"
```

**Nota:** `@react-native-community/netinfo` potrebbe richiedere installazione — CHIEDERE CONFERMA.

**Criteri di accettazione:**
- [ ] Dati principali cachati localmente (roster, contratti, membri lega)
- [ ] Banner "Sei offline" quando la rete non e' disponibile
- [ ] Dati offline con indicazione timestamp ultimo aggiornamento
- [ ] Cache TTL di 15 minuti
- [ ] Refresh automatico quando la rete torna disponibile

---

#### N5.4 — APP-026: Haptic Feedback Sistematico (S, 1-2 giorni)

**File da creare:** `mobile/src/utils/haptics.ts`
**File da modificare:** Tutti gli screen con azioni importanti

**Cosa fare:**
```typescript
// mobile/src/utils/haptics.ts
import { Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTIC_ENABLED_KEY = 'haptic_enabled';

let hapticEnabled = true;

export const haptics = {
  init: async (): Promise<void> => {
    const value = await AsyncStorage.getItem(HAPTIC_ENABLED_KEY);
    hapticEnabled = value !== 'false';
  },

  setEnabled: async (enabled: boolean): Promise<void> => {
    hapticEnabled = enabled;
    await AsyncStorage.setItem(HAPTIC_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  // Pattern leggeri
  tap: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate(10);
  },

  // Azioni principali
  success: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 30, 100]);
  },

  error: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 30, 50, 30, 50]);
  },

  warning: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 100]);
  },

  // Asta
  bidPlaced: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate(50);
  },

  outbid: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 100, 50, 100]);
  },

  auctionWon: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 30, 50, 30, 200]);
  },

  // Scambi
  tradeSent: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 50]);
  },

  tradeAccepted: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 30, 100]);
  },

  tradeRejected: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 30, 50, 30, 50]);
  },

  // Contratti
  contractSaved: (): void => {
    if (!hapticEnabled) return;
    Vibration.vibrate([0, 50, 30, 100]);
  },
};
```

**Criteri di accettazione:**
- [ ] Pattern haptic per: bid, outbid, win, success, error, warning
- [ ] Toggle on/off in SettingsScreen
- [ ] Preferenza persistente in AsyncStorage
- [ ] Integrato in: AuctionScreen, TradesScreen, ContractsScreen
- [ ] Nessun crash su dispositivi senza vibrazione

---

#### N5.5 — APP-027: Forgot Password (M, 2-3 giorni)

**File da creare:** `mobile/src/screens/auth/ForgotPasswordScreen.tsx`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`, `mobile/src/screens/auth/LoginScreen.tsx`

**Cosa fare:**
```typescript
// Aggiungere alla AuthStackParamList:
ForgotPassword: undefined;

// ForgotPasswordScreen:
// ┌──────────────────────────┐
// │  Icona mail              │
// │  "Recupero Password"     │
// │  "Inserisci la tua email │
// │   per ricevere il link   │
// │   di reset"              │
// ├──────────────────────────┤
// │  [Input email]           │
// │  [Bottone "Invia Link"]  │
// ├──────────────────────────┤
// │  Stato successo:         │
// │  "Email inviata! Controlla│
// │   la tua casella."       │
// │  [Torna al Login]        │
// └──────────────────────────┘

// API: POST /api/auth/forgot-password { email }
```

**Modifica LoginScreen.tsx:**
```typescript
// Aggiungere link sotto il form:
<TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
  <Text style={styles.forgotText}>Password dimenticata?</Text>
</TouchableOpacity>
```

**Criteri di accettazione:**
- [ ] Form con campo email
- [ ] Validazione email
- [ ] Loading state durante invio
- [ ] Messaggio successo dopo invio
- [ ] Gestione errore (email non trovata)
- [ ] Link da LoginScreen a ForgotPasswordScreen
- [ ] Bottone "Torna al Login"

---

### Chiusura Sprint N5
```bash
npx expo start
git add .
git commit -m "feat(mobile): Sprint N5 - Polish (APP-014, APP-017, APP-018, APP-026, APP-027)"
git push origin MOBILE-ANDROID
```

---

## SPRINT N6 — Release (~1 settimana, 4 task)

### Setup
```bash
git checkout MOBILE-ANDROID
git pull origin MOBILE-ANDROID
```

---

#### N6.1 — APP-023: CI/CD con EAS Build (L, 2-3 giorni)

**File da creare:** `mobile/eas.json`

**Cosa fare:**
```json
// mobile/eas.json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      },
      "ios": {
        "buildConfiguration": "Debug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_ASC_APP_ID"
      }
    }
  }
}
```

**Comandi:**
```bash
# Build di sviluppo
eas build --profile development --platform android

# Build preview (APK per test interni)
eas build --profile preview --platform android

# Build produzione
eas build --profile production --platform android
```

**Criteri di accettazione:**
- [ ] `eas.json` configurato con 3 profili (dev, preview, production)
- [ ] Build Android funzionante su EAS
- [ ] APK di test generabile con `eas build --profile preview`

---

#### N6.2 — APP-024: App Store / Play Store Prep (L, 2-3 giorni)

**File da modificare:** `mobile/app.json` / `mobile/app.config.js`

**Cosa fare:**
1. Aggiornare metadata:
```javascript
// app.config.js
{
  expo: {
    name: 'Fantacontratti',
    slug: 'fantacontratti-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'fantacontratti',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0a0a0b',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.fantacontratti.mobile',
      infoPlist: {
        NSCameraUsageDescription: 'Serve per la foto profilo',
        NSPhotoLibraryUsageDescription: 'Serve per selezionare la foto profilo',
        NSFaceIDUsageDescription: 'Serve per l\'accesso rapido',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0a0a0b',
      },
      package: 'com.fantacontratti.mobile',
      permissions: ['VIBRATE', 'CAMERA', 'READ_EXTERNAL_STORAGE'],
    },
    // ... extra, plugins, etc.
  }
}
```

2. Preparare screenshot per store (usa emulatore)
3. Scrivere descrizione store in italiano

**Criteri di accettazione:**
- [ ] Icone app corrette (icon.png, adaptive-icon.png, splash.png)
- [ ] Bundle identifier univoco
- [ ] Permessi dichiarati (camera, vibrazione, storage)
- [ ] Info.plist descriptions per iOS
- [ ] Versione 1.0.0

---

#### N6.3 — APP-025: Analytics (M, 1-2 giorni)

**File da creare:** `mobile/src/services/analytics.ts`
**File da modificare:** `mobile/src/navigation/AppNavigator.tsx`, screen principali

**Cosa fare:**
```typescript
// mobile/src/services/analytics.ts
// Tracking eventi base senza dipendenze esterne
// (usare un semplice logger che invia al backend)

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: string;
}

class AnalyticsService {
  private queue: AnalyticsEvent[] = [];
  private readonly FLUSH_INTERVAL = 30000; // 30 secondi
  private readonly MAX_QUEUE_SIZE = 50;

  track(name: string, properties?: Record<string, string | number | boolean>): void {
    this.queue.push({
      name,
      properties,
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  // Screen tracking
  trackScreen(screenName: string): void {
    this.track('screen_view', { screen: screenName });
  }

  // Azioni chiave
  trackBid(auctionId: string, amount: number): void {
    this.track('bid_placed', { auctionId, amount });
  }

  trackTrade(action: 'created' | 'accepted' | 'rejected'): void {
    this.track('trade_action', { action });
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const events = [...this.queue];
    this.queue = [];
    try {
      // Invio al backend (endpoint opzionale)
      // await api.post('/analytics/events', { events });
      console.log('[Analytics] Flushed', events.length, 'events');
    } catch {
      // Re-queue on failure
      this.queue.unshift(...events);
    }
  }
}

export const analytics = new AnalyticsService();
```

**Criteri di accettazione:**
- [ ] Tracking automatico screen views
- [ ] Tracking azioni chiave (bid, trade, login)
- [ ] Queue con flush periodico
- [ ] Nessuna dipendenza esterna aggiuntiva

---

#### N6.4 — APP-028: Animazioni con Reanimated (M, 2-3 giorni)

**Nota:** `react-native-reanimated` potrebbe richiedere installazione — CHIEDERE CONFERMA.

**File da modificare:** `mobile/babel.config.js`, screen principali

**Cosa fare:**
Se approvata l'installazione di `react-native-reanimated`:

1. Aggiornare `babel.config.js`:
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ... altri plugin
      'react-native-reanimated/plugin', // DEVE essere ultimo
    ],
  };
};
```

2. Animazioni da aggiungere:
   - **Tab switch**: animazione slide orizzontale quando si cambia tab
   - **Card entry**: fade-in + slide-up quando le card appaiono nella lista
   - **Bottone bid**: scale animation su pressione
   - **Timer**: pulse animation quando < 10 secondi
   - **Trade swipe**: swipe-to-accept / swipe-to-reject nel TradeDetailScreen
   - **Skeleton shimmer**: migliorare con Reanimated LinearGradient

**Se l'installazione NON viene approvata**, usare l'Animated API nativa (gia in uso nello Skeleton):
- Fade-in per le card
- Scale per i bottoni
- Slide per le transizioni

**Criteri di accettazione:**
- [ ] Animazioni fluide (60fps)
- [ ] Almeno 4 animazioni implementate
- [ ] Nessun impatto sulle performance
- [ ] Fallback funzionale se Reanimated non disponibile

---

### Chiusura Sprint N6
```bash
npx expo start
eas build --profile preview --platform android
git add .
git commit -m "feat(mobile): Sprint N6 - Release prep (APP-023..APP-025, APP-028)"
git push origin MOBILE-ANDROID
```

---

## Dipendenze npm (Riepilogo)

| Sprint | Pacchetto | Task | Incluso in Expo? | Note |
|--------|-----------|------|-------------------|------|
| N5 | `@react-native-community/netinfo` | APP-018 | No | Richiede installazione — chiedere conferma |
| N6 | `react-native-reanimated` | APP-028 | Parziale | Richiede installazione + plugin babel — chiedere conferma |

Tutti gli altri pacchetti necessari (`expo-local-authentication`, `expo-image-picker`, `expo-constants`, `expo-linking`, etc.) sono gia inclusi in Expo SDK 52.

---

## Dipendenze tra Sprint

```
N1 (Foundation) ──→ N2 (Asta) ──→ N3 (Scambi + Profilo)
                               └→ N4 (Schermate Mancanti)
N1 + N4 ──→ N5 (Polish) ──→ N6 (Release)
```

```
Settimana 1-2:  N1 Foundation
Settimana 3-4:  N2 Asta
Settimana 5-6:  N3 Scambi + N4 Schermate (parallelizzabili)
Settimana 7-8:  N5 Polish
Settimana 9:    N6 Release
```

**Durata totale stimata: 8-9 settimane.**

---

## Prompt Copia-Incolla per Ogni Sprint

### Sprint N1 — Foundation
```
Sono sul branch MOBILE-ANDROID di un progetto React Native + Expo. Devo implementare Sprint N1 del piano NATIVE_APP_SPRINT_PLAN.md.

Leggi il file NATIVE_APP_SPRINT_PLAN.md per i dettagli delle 6 task dello Sprint N1 (Foundation).
Lavora nella cartella mobile/. Il codice esistente usa:
- React Navigation 6 (bottom-tabs + native-stack)
- Context API (AuthContext, LeagueContext, NotificationContext)
- Axios per API con JWT (SecureStore)
- TypeScript strict mode
- Path alias @/ → mobile/src/
- Ionicons per icone

Implementa le 6 task nell'ordine indicato (APP-004, APP-005, APP-006, APP-012, APP-013, APP-007).
Per APP-005 (tema): devi aggiornare TUTTI gli screen esistenti per usare il nuovo file theme.ts centralizzato.
Committa ogni task separatamente con formato: "feat(mobile): APP-xxx descrizione".
```

### Sprint N2 — Asta
```
Sono sul branch MOBILE-ANDROID di un progetto React Native + Expo. Devo implementare Sprint N2 del piano NATIVE_APP_SPRINT_PLAN.md.

Leggi il file NATIVE_APP_SPRINT_PLAN.md per i dettagli delle 3 task dello Sprint N2 (Asta).
Sprint N1 e' gia completato: il tema centralizzato e' in mobile/src/theme/theme.ts, ErrorBoundary e Skeleton sono disponibili.

INIZIA da APP-001 (InitialAuctionScreen) — e' la task piu grande e crea componenti riusabili.
Poi APP-002 (RepairAuctionScreen) che riusa i componenti di APP-001.
Infine APP-008 (IndemnityScreen) che e' indipendente.

Il servizio Pusher e' gia configurato in mobile/src/services/pusher.ts con eventi:
bid-placed, nomination-confirmed, member-ready, auction-closed, timer-update, indemnity-decision-submitted, indemnity-all-decided, rubata-steal-declared.

L'API service e' in mobile/src/services/api.ts con endpoint per aste, bid, market sessions.
Committa ogni task separatamente.
```

### Sprint N3 — Scambi + Profilo
```
Sono sul branch MOBILE-ANDROID di un progetto React Native + Expo. Devo implementare Sprint N3 del piano NATIVE_APP_SPRINT_PLAN.md.

Leggi il file NATIVE_APP_SPRINT_PLAN.md per i dettagli delle 4 task dello Sprint N3 (Scambi + Profilo).
Sprint N1 e N2 sono completati.

INIZIA da APP-003 (TradesScreen + flusso) — e' la task piu grande con 3 screen e 3 componenti.
Poi APP-009 (ProfileScreen), APP-010 (SettingsScreen), APP-011 (HistoryScreen) in parallelo.

Per TradesScreen: il Pusher ha eventi trade-offer-received e trade-offer-responded.
Per ProfileScreen: expo-image-picker e' gia disponibile in Expo SDK 52.
Per SettingsScreen: usare AsyncStorage per persistere le preferenze.
Committa ogni task separatamente.
```

### Sprint N4 — Schermate Mancanti
```
Sono sul branch MOBILE-ANDROID di un progetto React Native + Expo. Devo implementare Sprint N4 del piano NATIVE_APP_SPRINT_PLAN.md.

Leggi il file NATIVE_APP_SPRINT_PLAN.md per i dettagli delle 6 task dello Sprint N4 (Schermate Mancanti).
Sprint N1-N3 sono completati.

Le 6 task sono indipendenti: APP-020 (AllPlayers), APP-019 (PlayerStats), APP-015 (LeagueDetail), APP-016 (Financials), APP-021 (Movements), APP-022 (Notifications).

INIZIA da APP-020 (AllPlayersScreen) perche' serve come base per APP-019 (PlayerStats).
Ogni nuova schermata va aggiunta alla navigazione in AppNavigator.tsx.
Riusa i pattern esistenti: FlatList, pull-to-refresh (useRefresh hook), Skeleton loading, tema centralizzato.
Committa ogni task separatamente.
```

### Sprint N5 — Polish
```
Sono sul branch MOBILE-ANDROID di un progetto React Native + Expo. Devo implementare Sprint N5 del piano NATIVE_APP_SPRINT_PLAN.md.

Leggi il file NATIVE_APP_SPRINT_PLAN.md per i dettagli delle 5 task dello Sprint N5 (Polish).
Sprint N1-N4 sono completati.

Le 5 task: APP-014 (Biometrics), APP-017 (Deep Linking), APP-018 (Offline), APP-026 (Haptics), APP-027 (Forgot Password).

NOTA: per APP-018 (Offline), potrebbe servire @react-native-community/netinfo — chiedi conferma prima di installare.
expo-local-authentication per APP-014 e' gia incluso in Expo SDK 52.
Committa ogni task separatamente.
```

### Sprint N6 — Release
```
Sono sul branch MOBILE-ANDROID di un progetto React Native + Expo. Devo implementare Sprint N6 del piano NATIVE_APP_SPRINT_PLAN.md.

Leggi il file NATIVE_APP_SPRINT_PLAN.md per i dettagli delle 4 task dello Sprint N6 (Release).
Sprint N1-N5 sono completati.

Le 4 task: APP-023 (CI/CD con EAS), APP-024 (Store Prep), APP-025 (Analytics), APP-028 (Animazioni).

NOTA: per APP-028 (Animazioni), potrebbe servire react-native-reanimated — chiedi conferma prima di installare. Se non approvato, usa l'Animated API nativa.
Committa ogni task separatamente. Al termine, fai una build preview con: eas build --profile preview --platform android.
```

---

## Riferimenti

| File | Descrizione |
|------|-------------|
| `NATIVE_APP_SPRINT_PLAN.md` | Questo file — piano sprint app nativa |
| `MOBILE_UI_SPRINT_PLAN.md` | Piano sprint mobile browser (web responsive) |
| `CLAUDE.md` | Workflow Git, credenziali, comandi |
| `mobile/src/navigation/AppNavigator.tsx` | Struttura navigazione completa |
| `mobile/src/services/api.ts` | Client API con tutti gli endpoint |
| `mobile/src/services/pusher.ts` | Servizio real-time con tutti gli eventi |
| `mobile/src/store/AuthContext.tsx` | Context autenticazione |
| `mobile/src/store/LeagueContext.tsx` | Context lega selezionata |
| `mobile/src/store/NotificationContext.tsx` | Context notifiche |
| `mobile/src/types/index.ts` | Tutti i tipi TypeScript del dominio |
| `mobile/src/screens/home/HomeScreen.tsx` | Esempio screen completo (pattern da seguire) |
| `mobile/src/screens/roster/RosterScreen.tsx` | Esempio screen con FlatList e filtri |

---

*Piano generato il 2026-02-08. Nessun file modificato.*
