import { apiCall, apiPost } from '$lib/api/client';
import { geocodingService } from './GeocodingService';
import { get } from 'svelte/store';
import { pollsState, votesState } from '$lib/stores/pollStore';

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

/**
 * Servicio de Votación
 * Maneja toda la lógica relacionada con votaciones
 */
export class VotingService {
  private static instance: VotingService;
  private pendingVotes: Map<string, any> = new Map();
  private voteQueue: Array<any> = [];
  private isProcessingQueue = false;

  private constructor() {}

  static getInstance(): VotingService {
    if (!VotingService.instance) {
      VotingService.instance = new VotingService();
    }
    return VotingService.instance;
  }

  /**
   * Enviar voto con geolocalización automática
   */
  async vote(
    pollId: number,
    optionKey: string,
    useLocation = true
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      // Verificar si ya votó
      const currentVotes = get(votesState);
      if (currentVotes.userVotes[pollId]) {
        return {
          success: false,
          error: 'Ya has votado en esta encuesta'
        };
      }

      // Marcar como votando
      votesState.update(s => ({ ...s, isVoting: true, voteError: null }));

      // Preparar datos del voto
      const voteData: any = {
        pollId,
        optionKey,
        timestamp: Date.now()
      };

      // Obtener ubicación si está habilitada
      if (useLocation) {
        const location = await this.getVoteLocation();
        if (location) {
          voteData.latitude = location.latitude;
          voteData.longitude = location.longitude;
          voteData.locationMethod = location.method;
          voteData.subdivisionId = location.subdivisionId;
        }
      }

      // Enviar voto al servidor
      const response = await apiPost(`/api/polls/${pollId}/vote`, voteData);

      if (!response.ok) {
        throw new Error(`Vote failed: ${response.status}`);
      }

      const result = await response.json();

      // Actualizar estado local
      votesState.update(s => ({
        ...s,
        userVotes: { ...s.userVotes, [pollId]: optionKey },
        isVoting: false
      }));

      // Actualizar encuesta activa si existe
      const polls = get(pollsState);
      if (polls.activePoll?.id === pollId && result.updatedPoll) {
        pollsState.update(s => ({
          ...s,
          activePoll: result.updatedPoll
        }));
      }

      // Disparar evento de voto exitoso
      this.dispatchVoteEvent(pollId, optionKey, result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[VotingService] Vote error:', error);
      
      votesState.update(s => ({
        ...s,
        isVoting: false,
        voteError: getErrorMessage(error)
      }));

      // Agregar a cola para reintentar
      this.addToQueue(pollId, optionKey);

      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Obtener ubicación para el voto
   */
  private async getVoteLocation(): Promise<any> {
    try {
      // Obtener coordenadas
      const coords = await geocodingService.getUserLocation();
      
      if (!coords) return null;

      // Hacer geocoding reverso
      const geocoded = await geocodingService.reverseGeocode(
        coords.latitude,
        coords.longitude
      );

      return {
        ...coords,
        ...geocoded
      };
    } catch (error) {
      console.error('[VotingService] Location error:', error);
      return null;
    }
  }

  /**
   * Votar múltiple (para encuestas de opción múltiple)
   */
  async voteMultiple(
    pollId: number,
    optionKeys: string[],
    useLocation = true
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      votesState.update(s => ({ ...s, isVoting: true, voteError: null }));

      const voteData: any = {
        pollId,
        optionKeys,
        timestamp: Date.now()
      };

      if (useLocation) {
        const location = await this.getVoteLocation();
        if (location) {
          voteData.latitude = location.latitude;
          voteData.longitude = location.longitude;
          voteData.locationMethod = location.method;
        }
      }

      const response = await apiPost(
        `/api/polls/${pollId}/vote-multiple`,
        voteData
      );

      if (!response.ok) {
        throw new Error(`Multiple vote failed: ${response.status}`);
      }

      const result = await response.json();

      // Actualizar estado
      votesState.update(s => ({
        ...s,
        multipleVotes: { ...s.multipleVotes, [pollId]: optionKeys },
        isVoting: false
      }));

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[VotingService] Multiple vote error:', error);
      
      votesState.update(s => ({
        ...s,
        isVoting: false,
        voteError: getErrorMessage(error)
      }));

      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Cambiar voto (si está permitido)
   */
  async changeVote(
    pollId: number,
    newOptionKey: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await apiPost(
        `/api/polls/${pollId}/change-vote`,
        { newOptionKey }
      );

      if (!response.ok) {
        throw new Error(`Change vote failed: ${response.status}`);
      }

      const result = await response.json();

      // Actualizar estado
      votesState.update(s => ({
        ...s,
        userVotes: { ...s.userVotes, [pollId]: newOptionKey }
      }));

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[VotingService] Change vote error:', error);
      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Eliminar voto (si está permitido)
   */
  async deleteVote(pollId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await apiCall(
        `/api/polls/${pollId}/vote`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error(`Delete vote failed: ${response.status}`);
      }

      // Actualizar estado
      votesState.update(s => {
        const newVotes = { ...s.userVotes };
        delete newVotes[pollId];
        return { ...s, userVotes: newVotes };
      });

      return { success: true };
    } catch (error) {
      console.error('[VotingService] Delete vote error:', error);
      return {
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Obtener historial de votos del usuario
   */
  async getUserVoteHistory(userId?: number): Promise<Array<{
    pollId: number;
    pollTitle: string;
    optionKey: string;
    optionLabel: string;
    votedAt: string;
  }>> {
    try {
      const endpoint = userId 
        ? `/api/users/${userId}/votes`
        : '/api/votes/my-history';
        
      const response = await apiCall(endpoint);

      if (!response.ok) {
        throw new Error('Failed to get vote history');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('[VotingService] Get history error:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas de votación geográfica
   */
  async getGeographicStats(
    pollId: number,
    level: 'country' | 'subdivision' | 'city' = 'country'
  ): Promise<Record<string, Record<string, number>>> {
    try {
      const endpoint = `/api/polls/${pollId}/votes-by-${level}`;
      const response = await apiCall(endpoint);

      if (!response.ok) {
        throw new Error('Failed to get geographic stats');
      }

      const result = await response.json();
      return result.data || {};
    } catch (error) {
      console.error('[VotingService] Get geo stats error:', error);
      return {};
    }
  }

  /**
   * Verificar si el usuario puede votar
   */
  async canVote(pollId: number): Promise<{
    canVote: boolean;
    reason?: string;
  }> {
    const votes = get(votesState);
    
    // Ya votó?
    if (votes.userVotes[pollId]) {
      return {
        canVote: false,
        reason: 'Ya has votado en esta encuesta'
      };
    }

    // Verificar con el servidor
    try {
      const response = await apiCall(`/api/polls/${pollId}/can-vote`);
      const result = await response.json();
      
      return {
        canVote: result.canVote,
        reason: result.reason
      };
    } catch (error) {
      return {
        canVote: true // Permitir por defecto si falla la verificación
      };
    }
  }

  /**
   * Agregar voto a cola de reintento
   */
  private addToQueue(pollId: number, optionKey: string) {
    this.voteQueue.push({
      pollId,
      optionKey,
      timestamp: Date.now(),
      retries: 0
    });

    // Procesar cola si no está en proceso
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Procesar cola de votos pendientes
   */
  private async processQueue() {
    if (this.voteQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;

    while (this.voteQueue.length > 0) {
      const vote = this.voteQueue.shift();
      
      if (vote.retries >= 3) {
        console.error('[VotingService] Max retries reached for vote:', vote);
        continue;
      }

      const result = await this.vote(vote.pollId, vote.optionKey, false);
      
      if (!result.success) {
        vote.retries++;
        this.voteQueue.push(vote);
        
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Disparar evento de voto
   */
  private dispatchVoteEvent(pollId: number, optionKey: string, result: any) {
    const event = new CustomEvent('vote', {
      detail: {
        pollId,
        optionKey,
        result,
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(event);
  }

  /**
   * Simular voto (para testing)
   */
  async simulateVote(pollId: number, count = 100): Promise<void> {
    if (import.meta.env.PROD) {
      console.error('Simulate vote only available in development');
      return;
    }

    console.log(`[VotingService] Simulating ${count} votes for poll ${pollId}`);

    for (let i = 0; i < count; i++) {
      const randomOption = Math.floor(Math.random() * 4);
      const optionKey = ['A', 'B', 'C', 'D'][randomOption];
      
      await apiPost(`/api/polls/${pollId}/simulate-vote`, {
        optionKey,
        latitude: 40 + Math.random() * 10,
        longitude: -4 + Math.random() * 10
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('[VotingService] Simulation complete');
  }

  /**
   * Limpiar votos locales
   */
  clearLocalVotes() {
    votesState.set({
      userVotes: {},
      multipleVotes: {},
      isVoting: false,
      voteError: null
    });
  }
}

// Exportar instancia única
export const votingService = VotingService.getInstance();

export default votingService;
