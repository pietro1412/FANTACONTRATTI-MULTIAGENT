import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';

// Screen imports - Auth Stack
import LoginScreen from '@/screens/auth/LoginScreen';

// Screen imports - Main Stack
import HomeScreen from '@/screens/home/HomeScreen';
import LeagueSelectionScreen from '@/screens/home/LeagueSelectionScreen';

// Screen imports - Rosa (Roster)
import RosterScreen from '@/screens/roster/RosterScreen';

// Screen imports - Mercato (Auctions)
import AuctionsScreen from '@/screens/auctions/AuctionsScreen';
import AuctionDetailScreen from '@/screens/auctions/AuctionDetailScreen';
import InitialAuctionScreen from '@/screens/auctions/InitialAuctionScreen';
import RepairAuctionScreen from '@/screens/auctions/RepairAuctionScreen';
import IndemnityScreen from '@/screens/auctions/IndemnityScreen';

// Screen imports - Scambi (Trades)
import TradesScreen from '@/screens/trades/TradesScreen';
import TradeDetailScreen from '@/screens/trades/TradeDetailScreen';
import CreateTradeScreen from '@/screens/trades/CreateTradeScreen';

// Screen imports - Altro (More)
import MoreScreen from '@/screens/more/MoreScreen';
import HistoryScreen from '@/screens/more/HistoryScreen';
import SettingsScreen from '@/screens/more/SettingsScreen';
import ProfileScreen from '@/screens/more/ProfileScreen';

// Screen imports - Contracts
import ContractsScreen from '@/screens/contracts/ContractsScreen';

// Screen imports - Admin
import LeagueManagementScreen from '@/screens/admin/LeagueManagementScreen';
import LeagueSettingsScreen from '@/screens/admin/LeagueSettingsScreen';

// Theme colors
const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  primary: '#6366F1',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: '#374151',
};

// Navigation type definitions
export type AuthStackParamList = {
  Login: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  LeagueSelection: undefined;
};

export type RosterStackParamList = {
  Roster: undefined;
};

export type AuctionsStackParamList = {
  Auctions: undefined;
  AuctionDetail: { auctionId: string };
  InitialAuction: { leagueId: string };
  RepairAuction: { leagueId: string };
  Indemnity: { leagueId: string };
};

export type TradesStackParamList = {
  Trades: undefined;
  TradeDetail: { tradeId: string };
  CreateTrade: undefined;
};

export type MoreStackParamList = {
  More: undefined;
  History: undefined;
  Settings: undefined;
  Profile: undefined;
  Contracts: undefined;
  LeagueManagement: undefined;
  LeagueSettings: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  RosaTab: undefined;
  MercatoTab: undefined;
  ScambiTab: undefined;
  AltroTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Stack navigators
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const RosterStack = createNativeStackNavigator<RosterStackParamList>();
const AuctionsStack = createNativeStackNavigator<AuctionsStackParamList>();
const TradesStack = createNativeStackNavigator<TradesStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

// Bottom tab navigator
const Tab = createBottomTabNavigator<MainTabParamList>();

// Default screen options for stacks
const defaultScreenOptions = {
  headerStyle: {
    backgroundColor: COLORS.card,
  },
  headerTintColor: COLORS.text,
  headerTitleStyle: {
    fontWeight: '600' as const,
  },
  contentStyle: {
    backgroundColor: COLORS.background,
  },
};

// Auth Stack Navigator
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// Home Stack Navigator
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={defaultScreenOptions}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <HomeStack.Screen
        name="LeagueSelection"
        component={LeagueSelectionScreen}
        options={{ title: 'Seleziona Lega' }}
      />
    </HomeStack.Navigator>
  );
}

// Roster Stack Navigator
function RosterStackNavigator() {
  return (
    <RosterStack.Navigator screenOptions={defaultScreenOptions}>
      <RosterStack.Screen
        name="Roster"
        component={RosterScreen}
        options={{ title: 'La Mia Rosa' }}
      />
    </RosterStack.Navigator>
  );
}

// Auctions Stack Navigator
function AuctionsStackNavigator() {
  return (
    <AuctionsStack.Navigator screenOptions={defaultScreenOptions}>
      <AuctionsStack.Screen
        name="Auctions"
        component={AuctionsScreen}
        options={{ title: 'Mercato' }}
      />
      <AuctionsStack.Screen
        name="AuctionDetail"
        component={AuctionDetailScreen}
        options={{ title: 'Dettaglio Asta' }}
      />
      <AuctionsStack.Screen
        name="InitialAuction"
        component={InitialAuctionScreen}
        options={{ title: 'Asta Iniziale' }}
      />
      <AuctionsStack.Screen
        name="RepairAuction"
        component={RepairAuctionScreen}
        options={{ title: 'Asta Riparazione' }}
      />
      <AuctionsStack.Screen
        name="Indemnity"
        component={IndemnityScreen}
        options={{ title: 'Indennizzi' }}
      />
    </AuctionsStack.Navigator>
  );
}

// Trades Stack Navigator
function TradesStackNavigator() {
  return (
    <TradesStack.Navigator screenOptions={defaultScreenOptions}>
      <TradesStack.Screen
        name="Trades"
        component={TradesScreen}
        options={{ title: 'Scambi' }}
      />
      <TradesStack.Screen
        name="TradeDetail"
        component={TradeDetailScreen}
        options={{ title: 'Dettaglio Scambio' }}
      />
      <TradesStack.Screen
        name="CreateTrade"
        component={CreateTradeScreen}
        options={{ title: 'Proponi Scambio' }}
      />
    </TradesStack.Navigator>
  );
}

// More Stack Navigator
function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={defaultScreenOptions}>
      <MoreStack.Screen
        name="More"
        component={MoreScreen}
        options={{ title: 'Altro' }}
      />
      <MoreStack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Storico' }}
      />
      <MoreStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Impostazioni' }}
      />
      <MoreStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profilo' }}
      />
      <MoreStack.Screen
        name="Contracts"
        component={ContractsScreen}
        options={{ title: 'Contratti' }}
      />
      <MoreStack.Screen
        name="LeagueManagement"
        component={LeagueManagementScreen}
        options={{ title: 'Gestione Lega' }}
      />
      <MoreStack.Screen
        name="LeagueSettings"
        component={LeagueSettingsScreen}
        options={{ title: 'Impostazioni Lega' }}
      />
    </MoreStack.Navigator>
  );
}

// Main Tab Navigator
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'HomeTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'RosaTab':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'MercatoTab':
              iconName = focused ? 'cart' : 'cart-outline';
              break;
            case 'ScambiTab':
              iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
              break;
            case 'AltroTab':
              iconName = focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="RosaTab"
        component={RosterStackNavigator}
        options={{ tabBarLabel: 'Rosa' }}
      />
      <Tab.Screen
        name="MercatoTab"
        component={AuctionsStackNavigator}
        options={{ tabBarLabel: 'Mercato' }}
      />
      <Tab.Screen
        name="ScambiTab"
        component={TradesStackNavigator}
        options={{ tabBarLabel: 'Scambi' }}
      />
      <Tab.Screen
        name="AltroTab"
        component={MoreStackNavigator}
        options={{ tabBarLabel: 'Altro' }}
      />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      )}
    </RootStack.Navigator>
  );
}

// Export navigation types for use in screens
export type { AuthStackParamList, HomeStackParamList, RosterStackParamList, AuctionsStackParamList, TradesStackParamList, MoreStackParamList, MainTabParamList, RootStackParamList };
