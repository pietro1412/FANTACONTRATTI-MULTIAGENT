// =============================================================================
// MoreScreen - Menu screen for FantaContratti Mobile App
// =============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { useLeague } from '@/store/LeagueContext';
import { MoreStackParamList } from '@/navigation/AppNavigator';

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  background: '#1a1a2e',
  card: '#252542',
  cardBorder: '#3d3d5c',
  primary: '#6366F1',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  error: '#EF4444',
  warning: '#F59E0B',
};

type NavigationProp = NativeStackNavigationProp<MoreStackParamList>;

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  route?: keyof MoreStackParamList;
  action?: () => void;
  requiresLeague?: boolean;
  adminOnly?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export default function MoreScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { selectedLeague, selectedMember } = useLeague();

  // Check if user is admin
  const isAdmin = selectedMember?.role === 'ADMIN';

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleLogout = () => {
    Alert.alert(
      'Conferma Logout',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.requiresLeague && !selectedLeague) {
      Alert.alert(
        'Nessuna lega selezionata',
        'Seleziona una lega dalla schermata Home per accedere a questa sezione.'
      );
      return;
    }

    if (item.route) {
      navigation.navigate(item.route);
    } else if (item.action) {
      item.action();
    }
  };

  // ===========================================================================
  // Menu Items
  // ===========================================================================

  const allMenuItems: MenuItem[] = [
    {
      id: 'league-management',
      title: 'Gestione Lega',
      subtitle: 'Gestisci membri, inviti e mercato',
      icon: 'shield-checkmark-outline',
      iconColor: '#8B5CF6',
      route: 'LeagueManagement',
      requiresLeague: true,
      adminOnly: true,
    },
    {
      id: 'contracts',
      title: 'Contratti',
      subtitle: 'Gestisci i contratti dei tuoi giocatori',
      icon: 'document-text-outline',
      iconColor: COLORS.primary,
      route: 'Contracts',
      requiresLeague: true,
    },
    {
      id: 'history',
      title: 'Storico',
      subtitle: 'Visualizza lo storico delle sessioni',
      icon: 'time-outline',
      iconColor: COLORS.warning,
      route: 'History',
      requiresLeague: true,
    },
    {
      id: 'profile',
      title: 'Profilo',
      subtitle: 'Visualizza il tuo profilo',
      icon: 'person-outline',
      iconColor: COLORS.primary,
      route: 'Profile',
    },
    {
      id: 'settings',
      title: 'Impostazioni',
      subtitle: 'Configura le preferenze dell\'app',
      icon: 'settings-outline',
      iconColor: COLORS.textSecondary,
      route: 'Settings',
    },
    {
      id: 'logout',
      title: 'Esci',
      subtitle: 'Disconnetti il tuo account',
      icon: 'log-out-outline',
      iconColor: COLORS.error,
      action: handleLogout,
    },
  ];

  // Filter menu items based on admin status
  const menuItems = allMenuItems.filter(item => !item.adminOnly || isAdmin);

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name || 'Utente'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {selectedLeague && (
            <View style={styles.leagueBadge}>
              <Ionicons name="trophy-outline" size={12} color={COLORS.primary} />
              <Text style={styles.leagueText}>{selectedLeague.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Menu</Text>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuItem,
              index === menuItems.length - 1 && styles.menuItemLast,
            ]}
            onPress={() => handleMenuPress(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: item.iconColor + '20' }]}>
              <Ionicons name={item.icon} size={22} color={item.iconColor} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[
                styles.menuTitle,
                item.id === 'logout' && styles.menuTitleDanger,
              ]}>
                {item.title}
              </Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>FantaContratti Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },

  // User Card
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 24,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  leagueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  leagueText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Menu Section
  menuSection: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  menuTitleDanger: {
    color: COLORS.error,
  },
  menuSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  appVersion: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
