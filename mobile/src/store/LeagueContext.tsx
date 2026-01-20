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
import { leaguesApi, rosterApi, ApiResponse } from '../services/api';

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
      const membersResponse = await leaguesApi.getLeagueMembers(leagueId);
      if (membersResponse.success && membersResponse.data) {
        // The API should return members including the current user
        // For now, we'll just take the first member that has status ACCEPTED
        const activeMember = membersResponse.data.find(m => m.status === 'ACCEPTED');
        if (activeMember) {
          setSelectedMember(activeMember);
        }
      }
    } catch (err) {
      console.error('Error loading member info:', err);
    }
  }, []);

  /**
   * Load saved league selection from AsyncStorage
   */
  const loadSavedLeague = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const savedLeagueJson = await AsyncStorage.getItem(SELECTED_LEAGUE_KEY);

      if (savedLeagueJson) {
        const savedLeague: League = JSON.parse(savedLeagueJson);

        // Verify the league still exists and user has access
        const response = await leaguesApi.getLeagueById(savedLeague.id);

        if (response.success && response.data) {
          setSelectedLeague(response.data);
          await loadMemberInfo(response.data.id);
          await loadLeagueStats(response.data.id);
        } else {
          // League no longer accessible, clear storage
          await AsyncStorage.removeItem(SELECTED_LEAGUE_KEY);
          setSelectedLeague(null);
          setSelectedMember(null);
          setLeagueStats(null);
        }
      }
    } catch (err) {
      console.error('Error loading saved league:', err);
      setError('Errore nel caricamento della lega salvata');
      // Clear potentially corrupted data
      await AsyncStorage.removeItem(SELECTED_LEAGUE_KEY);
    } finally {
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
