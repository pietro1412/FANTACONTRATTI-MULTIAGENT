/**
 * Admin API Tests - TDD approach
 * Tests for admin-only league management endpoints
 */

import { adminApi } from '../services/api';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    __mockInstance: mockAxiosInstance,
  };
});

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const axios = require('axios');
const mockAxios = axios.__mockInstance;

describe('Admin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingRequests', () => {
    it('should fetch pending join requests for a league', async () => {
      const mockPendingRequests = [
        {
          id: 'member-1',
          userId: 'user-1',
          username: 'TestUser1',
          teamName: 'Test Team 1',
          status: 'PENDING',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'member-2',
          userId: 'user-2',
          username: 'TestUser2',
          teamName: 'Test Team 2',
          status: 'PENDING',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      mockAxios.get.mockResolvedValueOnce({
        data: { success: true, data: mockPendingRequests },
      });

      const result = await adminApi.getPendingRequests('league-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe('PENDING');
    });

    it('should handle errors when fetching pending requests', async () => {
      mockAxios.get.mockRejectedValueOnce({
        success: false,
        message: 'Unauthorized',
      });

      const result = await adminApi.getPendingRequests('league-123');

      expect(result.success).toBe(false);
    });
  });

  describe('handleMemberRequest', () => {
    it('should approve a join request', async () => {
      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, message: 'Richiesta approvata' },
      });

      const result = await adminApi.handleMemberRequest('league-123', 'member-1', 'accept');

      expect(result.success).toBe(true);
    });

    it('should reject a join request', async () => {
      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, message: 'Richiesta rifiutata' },
      });

      const result = await adminApi.handleMemberRequest('league-123', 'member-1', 'reject');

      expect(result.success).toBe(true);
    });

    it('should kick a member', async () => {
      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, message: 'Membro rimosso' },
      });

      const result = await adminApi.handleMemberRequest('league-123', 'member-1', 'kick');

      expect(result.success).toBe(true);
    });
  });

  describe('startMarket', () => {
    it('should start a new market session', async () => {
      const mockSession = {
        id: 'session-123',
        leagueId: 'league-123',
        status: 'ACTIVE',
        isFirstMarket: true,
      };

      mockAxios.post.mockResolvedValueOnce({
        data: { success: true, data: mockSession },
      });

      const result = await adminApi.startMarket('league-123');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ACTIVE');
    });

    it('should start a regular market session', async () => {
      const mockSession = {
        id: 'session-456',
        leagueId: 'league-123',
        status: 'ACTIVE',
        isFirstMarket: false,
      };

      mockAxios.post.mockResolvedValueOnce({
        data: { success: true, data: mockSession },
      });

      const result = await adminApi.startMarket('league-123', true);

      expect(result.success).toBe(true);
      expect(result.data?.isFirstMarket).toBe(false);
    });
  });

  describe('startLeague', () => {
    it('should start the league and initiate first market', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { success: true, message: 'Lega avviata con successo' },
      });

      const result = await adminApi.startLeague('league-123');

      expect(result.success).toBe(true);
    });
  });

  describe('updateLeague', () => {
    it('should update league settings', async () => {
      const updates = {
        name: 'Updated League Name',
        description: 'Updated description',
      };

      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, data: { id: 'league-123', ...updates } },
      });

      const result = await adminApi.updateLeague('league-123', updates);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated League Name');
    });
  });

  describe('setMarketPhase', () => {
    it('should update market phase', async () => {
      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, message: 'Fase aggiornata' },
      });

      const result = await adminApi.setMarketPhase('session-123', 'ASTA_RUBATA');

      expect(result.success).toBe(true);
    });
  });

  describe('closeMarketSession', () => {
    it('should close a market session', async () => {
      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, message: 'Sessione chiusa' },
      });

      const result = await adminApi.closeMarketSession('session-123');

      expect(result.success).toBe(true);
    });
  });

  describe('setTurnOrder', () => {
    it('should set turn order for first market', async () => {
      const memberOrder = ['member-1', 'member-2', 'member-3'];

      mockAxios.put.mockResolvedValueOnce({
        data: { success: true, message: 'Ordine turni impostato' },
      });

      const result = await adminApi.setTurnOrder('session-123', memberOrder);

      expect(result.success).toBe(true);
    });
  });
});
