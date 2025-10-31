import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { VotingService } from '../VotingService';
import { geocodingService } from '../GeocodingService';
import { get } from 'svelte/store';
import { pollsState, votesState } from '$lib/stores/pollStore';

// Mock de fetch global
global.fetch = vi.fn();

// Mock de stores
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
  }))
}));

// Mock de geocodingService
vi.mock('../GeocodingService', () => ({
  geocodingService: {
    getUserLocation: vi.fn(),
    reverseGeocode: vi.fn()
  }
}));

// Mock de stores
vi.mock('$lib/stores/pollStore', () => ({
  pollsState: {
    update: vi.fn(),
    subscribe: vi.fn()
  },
  votesState: {
    update: vi.fn(),
    subscribe: vi.fn()
  }
}));

describe('VotingService', () => {
  let service: VotingService;

  beforeEach(() => {
    service = VotingService.getInstance();
    vi.clearAllMocks();
    
    // Mock default para get store
    (get as Mock).mockReturnValue({
      userVotes: {},
      multipleVotes: {},
      isVoting: false,
      voteError: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = VotingService.getInstance();
      const instance2 = VotingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('vote', () => {
    it('should send vote with location', async () => {
      const mockLocation = {
        latitude: 40.4168,
        longitude: -3.7038,
        method: 'gps'
      };

      const mockGeocode = {
        subdivisionId: 123,
        subdivisionName: 'Madrid',
        level: 2
      };

      (geocodingService.getUserLocation as Mock).mockResolvedValue(mockLocation);
      (geocodingService.reverseGeocode as Mock).mockResolvedValue(mockGeocode);

      const mockVoteResponse = {
        success: true,
        updatedPoll: {
          id: 1,
          title: 'Test Poll',
          totalVotes: 101
        }
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVoteResponse
      });

      const result = await service.vote(1, 'option-a', true);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVoteResponse);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/vote'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"latitude":40.4168')
        })
      );

      expect(votesState.update).toHaveBeenCalledTimes(2);
    });

    it('should send vote without location when disabled', async () => {
      const mockVoteResponse = {
        success: true
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVoteResponse
      });

      const result = await service.vote(1, 'option-a', false);

      expect(result.success).toBe(true);
      expect(geocodingService.getUserLocation).not.toHaveBeenCalled();
      
      const fetchCall = (global.fetch as Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.latitude).toBeUndefined();
    });

    it('should prevent duplicate voting', async () => {
      (get as Mock).mockReturnValue({
        userVotes: { '1': 'option-a' },
        multipleVotes: {},
        isVoting: false,
        voteError: null
      });

      const result = await service.vote(1, 'option-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Ya has votado en esta encuesta');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.vote(1, 'option-a', false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Vote failed: 500');
      expect(votesState.update).toHaveBeenCalled();
    });

    it('should update active poll if voting on active poll', async () => {
      (get as Mock).mockImplementation((store) => {
        if (store === votesState) {
          return { userVotes: {}, multipleVotes: {} };
        }
        if (store === pollsState) {
          return { activePoll: { id: 1 } };
        }
        return {};
      });

      const mockVoteResponse = {
        success: true,
        updatedPoll: { id: 1, totalVotes: 101 }
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVoteResponse
      });

      await service.vote(1, 'option-a', false);

      expect(pollsState.update).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should dispatch vote event on success', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.vote(1, 'option-a', false);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vote',
          detail: expect.objectContaining({
            pollId: 1,
            optionKey: 'option-a'
          })
        })
      );
    });
  });

  describe('voteMultiple', () => {
    it('should send multiple votes', async () => {
      const mockLocation = {
        latitude: 40.4168,
        longitude: -3.7038,
        method: 'ip'
      };

      (geocodingService.getUserLocation as Mock).mockResolvedValue(mockLocation);

      const mockResponse = {
        success: true,
        votes: ['option-a', 'option-b']
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.voteMultiple(1, ['option-a', 'option-b']);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/vote-multiple'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"optionKeys":["option-a","option-b"]')
        })
      );

      expect(votesState.update).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should handle API errors for multiple votes', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      const result = await service.voteMultiple(1, ['option-a', 'option-b']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Multiple vote failed: 400');
    });
  });

  describe('changeVote', () => {
    it('should change existing vote', async () => {
      const mockResponse = {
        success: true,
        newOption: 'option-b'
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.changeVote(1, 'option-b');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/change-vote'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"newOptionKey":"option-b"')
        })
      );

      expect(votesState.update).toHaveBeenCalled();
    });
  });

  describe('deleteVote', () => {
    it('should delete existing vote', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await service.deleteVote(1);

      expect(result.success).toBe(true);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/vote'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );

      expect(votesState.update).toHaveBeenCalled();
    });
  });

  describe('getUserVoteHistory', () => {
    it('should get vote history for specific user', async () => {
      const mockHistory = [
        {
          pollId: 1,
          pollTitle: 'Poll 1',
          optionKey: 'option-a',
          optionLabel: 'Option A',
          votedAt: '2024-01-01T00:00:00Z'
        },
        {
          pollId: 2,
          pollTitle: 'Poll 2',
          optionKey: 'option-b',
          optionLabel: 'Option B',
          votedAt: '2024-01-02T00:00:00Z'
        }
      ];

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory })
      });

      const result = await service.getUserVoteHistory(123);

      expect(result).toEqual(mockHistory);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/123/votes')
      );
    });

    it('should get current user vote history when no userId provided', async () => {
      const mockHistory: any[] = [];

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockHistory })
      });

      const result = await service.getUserVoteHistory();

      expect(result).toEqual(mockHistory);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/votes/my-history')
      );
    });
  });

  describe('getGeographicStats', () => {
    it('should get country-level stats', async () => {
      const mockStats = {
        'ESP': { 'option-a': 50, 'option-b': 30 },
        'FRA': { 'option-a': 20, 'option-b': 40 }
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockStats })
      });

      const result = await service.getGeographicStats(1, 'country');

      expect(result).toEqual(mockStats);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/votes-by-country')
      );
    });

    it('should get subdivision-level stats', async () => {
      const mockStats = {
        '123': { 'option-a': 25, 'option-b': 15 },
        '456': { 'option-a': 10, 'option-b': 20 }
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockStats })
      });

      const result = await service.getGeographicStats(1, 'subdivision');

      expect(result).toEqual(mockStats);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/votes-by-subdivision')
      );
    });
  });

  describe('canVote', () => {
    it('should check if user can vote', async () => {
      (get as Mock).mockReturnValue({
        userVotes: {},
        multipleVotes: {}
      });

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ canVote: true })
      });

      const result = await service.canVote(1);

      expect(result.canVote).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prevent voting if already voted', async () => {
      (get as Mock).mockReturnValue({
        userVotes: { '1': 'option-a' },
        multipleVotes: {}
      });

      const result = await service.canVote(1);

      expect(result.canVote).toBe(false);
      expect(result.reason).toBe('Ya has votado en esta encuesta');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should allow voting on API error', async () => {
      (get as Mock).mockReturnValue({
        userVotes: {},
        multipleVotes: {}
      });

      (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.canVote(1);

      expect(result.canVote).toBe(true);
    });
  });

  describe('clearLocalVotes', () => {
    it('should clear all local votes', () => {
      service.clearLocalVotes();

      expect(votesState.set).toHaveBeenCalledWith({
        userVotes: {},
        multipleVotes: {},
        isVoting: false,
        voteError: null
      });
    });
  });

  describe('simulateVote', () => {
    it('should not run in production', async () => {
      const originalEnv = import.meta.env.PROD;
      Object.defineProperty(import.meta.env, 'PROD', {
        value: true,
        writable: true
      });

      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      await service.simulateVote(1, 10);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Simulate vote only available in development'
      );
      expect(global.fetch).not.toHaveBeenCalled();

      Object.defineProperty(import.meta.env, 'PROD', {
        value: originalEnv,
        writable: true
      });
    });

    it('should simulate votes in development', async () => {
      const originalEnv = import.meta.env.PROD;
      Object.defineProperty(import.meta.env, 'PROD', {
        value: false,
        writable: true
      });

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await service.simulateVote(1, 2);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/polls/1/simulate-vote'),
        expect.any(Object)
      );

      Object.defineProperty(import.meta.env, 'PROD', {
        value: originalEnv,
        writable: true
      });
    });
  });
});
