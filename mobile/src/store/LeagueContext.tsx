// =============================================================================
// LeagueContext - League Selection Context for FantaContratti Mobile App
// =============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { League, LeagueMember } from '../types';
import { leaguesApi, rosterApi, ApiResponse, authApi } from '../services/api';

// =============================================================================
// Constants
// =============================================================================

const SELECTED_LEAGUE_KEY = 'fantacontratti_selected_league';

// =============================================================================
// Context Types
// =============================================================================

export interface LeagueStats {
  activeAuctions: number;
  pendingTrades: number;
  rosterCount: number;
  maxRosterSlots: number;
}

export interface LeagueContextType {
  // State
  selectedLeague: League | null;
  selectedMember: LeagueMember | null;
  leagueStats: LeagueStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  selectLeague: (league: League) => Promise<void>;
  clearSelectedLeague: () => Promise<void>;
  refreshLeagueData: () => Promise<void>;
}

// =============================================================================
// Context Creation
// =============================================================================

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

// =============================================================================
// LeagueProvider Component
// =============================================================================

interface LeagueProviderProps {
  children: ReactNode;
}

export function LeagueProvider({ children }: LeagueProviderProps): JSX.Element {
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [selectedMember, setSelectedMember] = useState<LeagueMember | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load league stats for the selected league
   */
  const loadLeagueStats = useCallback(async (leagueId: string): Promise<void> => {
    try {
      // Get roster to calculate roster count
      const rosterResponse = await rosterApi.getRoster(leagueId);
      const rosterCount = rosterResponse.success && rosterResponse.data
        ? rosterResponse.data.length
        : 0;

      // Get league details for max roster slots
      const leagueResponse = await leaguesApi.getLeagueById(leagueId);
      let maxRosterSlots = 25; // Default
      if (leagueResponse.success && leagueResponse.data?.config) {
        const config = leagueResponse.data.config;
        maxRosterSlots =
          config.goalkeeperSlots +
          config.defenderSlots +
          config.midfielderSlots +
          config.forwardSlots;
      }

      // TODO: Add API calls for active auctions and pending trades when available
      setLeagueStats({
        activeAuctions: 0,
        pendingTrades: 0,
        rosterCount,
        maxRosterSlots,
      });
    } catch (err) {
      console.error('Error loading league stats:', err);
      setLeagueStats({
        activeAuctions: 0,
        pendingTrades: 0,
        rosterCount: 0,
        maxRosterSlots: 25,
      });
    }
  }, []);

  /**
   * Load current member info for the selected league
   */
  const loadMemberInfo = useCallback(async (leagueId: string): Promise<void> => {
    try {
      // Get current user first
      const userResponse = await authApi.getCurrentUser();
      console.log('[LeagueContext] loadMemberInfo - current user:', userResponse.data?.id);

      if (!userResponse.success || !userResponse.data) {
        console.error('[LeagueContext] loadMemberInfo - could not get current user');
        return;
      }

      const currentUserId = userResponse.data.id;

      const membersResponse = await leaguesApi.getLeagueMembers(leagueId);
      console.log('[LeagueContext] loadMemberInfo - response:', JSON.stringify(membersResponse, null, 2));

      if (membersResponse.success && membersResponse.data) {
        const membersArray = Array.isArray(membersResponse.data) ? membersResponse.data : [];
        console.log('[LeagueContext] loadMemberInfo - members count:', membersArray.length);

        // Find the member that belongs to the current user
        const currentUserMember = membersArray.find((m: LeagueMember) =>
          m.userId === currentUserId && (m.status === 'ACCEPTED' || m.status === 'ACTIVE')
        );

        if (currentUserMember) {
          console.log('[LeagueContext] loadMemberInfo - found current user member:', currentUserMember.username, 'role:', currentUserMember.role);
          setSelectedMember(currentUserMember);
        } else {
          console.log('[LeagueContext] loadMemberInfo - current user not found in members, userId:', currentUserId);
        }
      }
    } catch (err) {
      console.error('[LeagueContext] loadMemberInfo - error:', err);
    }
  }, []);

  /**
   * Load saved league selection from AsyncStorage
   */
  const loadSavedLeague = useCallback(async (): Promise<void> => {
    console.log('[LeagueContext] loadSavedLeague - starting');
    setIsLoading(true);
    setError(null);
    try {
      const savedLeagueJson = await AsyncStorage.getItem(SELECTED_LEAGUE_KEY);
      console.log('[LeagueContext] loadSavedLeague - savedLeagueJson:', savedLeagueJson ? 'exists' : 'null');

      if (savedLeagueJson) {
        const savedLeague: League = JSON.parse(savedLeagueJson);
        console.log('[LeagueContext] loadSavedLeague - parsed league:', savedLeague.id);

        // Verify the league still exists and user has access
        console.log('[LeagueContext] loadSavedLeague - calling getLeagueById...');
        const response = await leaguesApi.getLeagueById(savedLeague.id);
        console.log('[LeagueContext] loadSavedLeague - getLeagueById response:', response.success);

        if (response.success && response.data) {
          setSelectedLeague(response.data);
          console.log('[LeagueContext] loadSavedLeague - loading member info...');
          await loadMemberInfo(response.data.id);
          console.log('[LeagueContext] loadSavedLeague - loading stats...');
          await loadLeagueStats(response.data.id);
          console.log('[LeagueContext] loadSavedLeague - done');
        } else {
          // League no longer accessible, clear storage
          console.log('[LeagueContext] loadSavedLeague - league not accessible, clearing');
          await AsyncStorage.removeItem(SELECTED_LEAGUE_KEY);
          setSelectedLeague(null);
          setSelectedMember(null);
          setLeagueStats(null);
        }
      } else {
        console.log('[LeagueContext] loadSavedLeague - no saved league');
      }
    } catch (err) {
      console.error('[LeagueContext] loadSavedLeague - error:', err);
      setError('Errore nel caricamento della lega salvata');
      // Clear potentially corrupted data
      await AsyncStorage.removeItem(SELECTED_LEAGUE_KEY);
    } finally {
      console.log('[LeagueContext] loadSavedLeague - setting isLoading false');
      setIsLoading(false);
    }
  }, [loadMemberInfo, loadLeagueStats]);

  /**
   * Select a league and persist the selection
   */
  const selectLeague = useCallback(async (league: League): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(SELECTED_LEAGUE_KEY, JSON.stringify(league));

      // Update state
      setSelectedLeague(league);

      // Load additional data
      await loadMemberInfo(league.id);
      await loadLeagueStats(league.id);
    } catch (err) {
      console.error('Error selecting league:', err);
      setError('Errore nella selezione della lega');
    } finally {
      setIsLoading(false);
    }
  }, [loadMemberInfo, loadLeagueStats]);

  /**
   * Clear the selected league
   */
  const clearSelectedLeague = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem(SELECTED_LEAGUE_KEY);
      setSelectedLeague(null);
      setSelectedMember(null);
      setLeagueStats(null);
      setError(null);
    } catch (err) {
      console.error('Error clearing selected league:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh current league data
   */
  const refreshLeagueData = useCallback(async (): Promise<void> => {
    if (!selectedLeague) return;

    setIsLoading(true);
    setError(null);
    try {
      // Refresh league details
      const response = await leaguesApi.getLeagueById(selectedLeague.id);

      if (response.success && response.data) {
        setSelectedLeague(response.data);
        await AsyncStorage.setItem(SELECTED_LEAGUE_KEY, JSON.stringify(response.data));
        await loadMemberInfo(response.data.id);
        await loadLeagueStats(response.data.id);
      } else {
        setError('Errore nel refresh della lega');
      }
    } catch (err) {
      console.error('Error refreshing league data:', err);
      setError('Errore nel refresh dei dati');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLeague, loadMemberInfo, loadLeagueStats]);

  // Load saved league on mount
  useEffect(() => {
    loadSavedLeague();
  }, [loadSavedLeague]);

  // =============================================================================
  // Context Value
  // =============================================================================

  const contextValue: LeagueContextType = {
    selectedLeague,
    selectedMember,
    leagueStats,
    isLoading,
    error,
    selectLeague,
    clearSelectedLeague,
    refreshLeagueData,
  };

  return (
    <LeagueContext.Provider value={contextValue}>
      {children}
    </LeagueContext.Provider>
  );
}

// =============================================================================
// useLeague Hook
// =============================================================================

/**
 * Custom hook to access the league context
 * Must be used within a LeagueProvider
 */
export function useLeague(): LeagueContextType {
  const context = useContext(LeagueContext);

  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }

  return context;
}

// =============================================================================
// Exports
// =============================================================================

export { LeagueContext };
