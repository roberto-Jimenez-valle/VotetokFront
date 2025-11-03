/**
 * Poll Data Service
 * Maneja la carga y agregación de datos de encuestas y votos
 */

import { apiCall } from '$lib/api/client';
import type { Poll, PollOption } from '$lib/stores/globalState';

export interface VotesBySubdivision {
  [subdivisionId: string]: {
    [optionKey: string]: number;
  };
}

export interface TrendingPoll {
  poll: Poll;
  totalVotes: number;
  pollKey: string;
}

/**
 * PollDataService - Servicio para cargar datos de encuestas
 */
export class PollDataService {
  /**
   * Cargar votos de una encuesta por país
   */
  async loadVotesByCountry(pollId: number | string): Promise<VotesBySubdivision> {
    try {
      const response = await apiCall(`/api/polls/${pollId}/votes-by-country`);
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando votos por país`);
        return {};
      }

      const { data } = await response.json();
      console.log(`[PollDataService] ✅ Votos por país cargados:`, Object.keys(data || {}).length, 'países');
      
      return data || {};
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading votes by country:', error);
      return {};
    }
  }

  /**
   * Cargar votos de una encuesta por subdivisiones (nivel 1)
   */
  async loadVotesBySubdivisions(
    pollId: number | string,
    countryIso: string
  ): Promise<VotesBySubdivision> {
    try {
      const response = await apiCall(
        `/api/polls/${pollId}/votes-by-subdivisions?country=${countryIso}`
      );
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando votos por subdivisiones`);
        return {};
      }

      const { data } = await response.json();
      
      // Filtrar solo nivel 1 exacto (ESP.1, ESP.2) - NO agregar de niveles inferiores
      const level1Data: VotesBySubdivision = {};
      for (const [subdivisionId, votes] of Object.entries(data || {})) {
        const parts = subdivisionId.split('.');
        if (parts.length === 2) {
          level1Data[subdivisionId] = votes as Record<string, number>;
        }
      }
      
      console.log(`[PollDataService] ✅ Votos nivel 1 cargados:`, Object.keys(level1Data).length, 'subdivisiones');
      
      return level1Data;
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading votes by subdivisions:', error);
      return {};
    }
  }

  /**
   * Cargar votos de una encuesta por sub-subdivisiones (nivel 2)
   */
  async loadVotesBySubSubdivisions(
    pollId: number | string,
    countryIso: string,
    subdivisionId: string
  ): Promise<VotesBySubdivision> {
    try {
      const cleanSubdivisionId = subdivisionId.includes('.') 
        ? subdivisionId.split('.').pop() 
        : subdivisionId;
      
      const response = await apiCall(
        `/api/polls/${pollId}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`
      );
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando votos por sub-subdivisiones`);
        return {};
      }

      const { data } = await response.json();
      
      // Filtrar solo nivel 2 exacto (ESP.1.1) - NO agregar de niveles inferiores
      const level2Data: VotesBySubdivision = {};
      for (const [subdivisionId, votes] of Object.entries(data || {})) {
        const parts = subdivisionId.split('.');
        if (parts.length === 3) {
          level2Data[subdivisionId] = votes as Record<string, number>;
        }
      }
      
      console.log(`[PollDataService] ✅ Votos nivel 2 cargados:`, Object.keys(level2Data).length, 'sub-subdivisiones');
      
      return level2Data;
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading votes by sub-subdivisions:', error);
      return {};
    }
  }

  /**
   * Cargar encuestas trending
   */
  async loadTrendingPolls(limit: number = 20): Promise<Poll[]> {
    try {
      const response = await apiCall(`/api/polls/trending?limit=${limit}`);
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando trending polls`);
        return [];
      }

      const { data } = await response.json();
      console.log(`[PollDataService] ✅ Trending polls cargados:`, data?.length || 0);
      
      return data || [];
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading trending polls:', error);
      return [];
    }
  }

  /**
   * Cargar encuestas trending por región
   */
  async loadTrendingPollsByRegion(
    region: string,
    limit: number = 20
  ): Promise<Poll[]> {
    try {
      const response = await apiCall(
        `/api/polls/trending-by-region?region=${encodeURIComponent(region)}&limit=${limit}`
      );
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando trending por región`);
        return [];
      }

      const { data } = await response.json();
      console.log(`[PollDataService] ✅ Trending por región cargados:`, data?.length || 0);
      
      return data || [];
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading trending polls by region:', error);
      return [];
    }
  }

  /**
   * Cargar encuestas trending con votos agregados en UNA sola petición
   * OPTIMIZACIÓN: En lugar de 21 peticiones, hace 1 sola
   */
  async loadTrendingAggregatedData(
    region: string,
    countryIso: string,
    limit: number = 20
  ): Promise<{
    polls: Poll[];
    aggregatedVotes: VotesBySubdivision;
  }> {
    try {
      const response = await apiCall(
        `/api/polls/trending-aggregated-data?region=${encodeURIComponent(region)}&country=${countryIso}&limit=${limit}`
      );
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando trending agregado`);
        return { polls: [], aggregatedVotes: {} };
      }

      const { data } = await response.json();
      console.log(`[PollDataService] ✅ Trending agregado cargado:`, data?.polls?.length || 0, 'encuestas');
      
      return {
        polls: data?.polls || [],
        aggregatedVotes: data?.aggregatedVotes || {}
      };
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading trending aggregated data:', error);
      return { polls: [], aggregatedVotes: {} };
    }
  }

  /**
   * Cargar datos completos de una encuesta
   */
  async loadPoll(pollId: number | string): Promise<Poll | null> {
    try {
      const response = await apiCall(`/api/polls/${pollId}`);
      
      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} cargando encuesta ${pollId}`);
        return null;
      }

      const result = await response.json();
      const poll = result.data || result;
      
      console.log(`[PollDataService] ✅ Encuesta cargada:`, poll.id);
      
      return poll;
    } catch (error) {
      console.error('[PollDataService] ❌ Error loading poll:', error);
      return null;
    }
  }

  /**
   * Agregar datos de trending polls para visualización mundial
   */
  async aggregateTrendingPollsData(
    polls: Poll[]
  ): Promise<{
    aggregatedData: VotesBySubdivision;
    aggregatedColors: Record<string, string>;
    pollOptions: PollOption[];
  }> {
    const aggregatedData: VotesBySubdivision = {};
    const aggregatedColors: Record<string, string> = {};
    const pollOptions: PollOption[] = [];
    
    const pollColors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
    ];

    // Procesar cada encuesta
    for (let i = 0; i < polls.length; i++) {
      const poll = polls[i];
      const pollKey = `poll_${poll.id}`;
      const pollColor = pollColors[i % pollColors.length];

      // Agregar color al mapa
      aggregatedColors[pollKey] = pollColor;

      // Agregar a opciones de poll
      pollOptions.push({
        key: pollKey,
        label: poll.question || poll.title || `Encuesta ${poll.id}`,
        color: pollColor,
        votes: 0, // Se actualizará después
        pollData: poll
      } as any);

      // Cargar datos de votos por país para esta encuesta
      try {
        const pollData = await this.loadVotesByCountry(poll.id);

        // Sumar TODOS los votos de esta encuesta por país
        for (const [countryIso, votes] of Object.entries(pollData)) {
          if (!aggregatedData[countryIso]) {
            aggregatedData[countryIso] = {};
          }

          const totalVotes = Object.values(votes).reduce((sum, count) => sum + (count as number), 0);
          aggregatedData[countryIso][pollKey] = totalVotes;
        }
      } catch (error) {
        console.warn(`[PollDataService] ⚠️ Error agregando datos de encuesta ${poll.id}:`, error);
      }
    }

    // Actualizar votos totales en opciones
    const updatedPollOptions = pollOptions.map(option => {
      const totalVotesForPoll = Object.values(aggregatedData).reduce((sum, countryData) => {
        return sum + (countryData[option.key] || 0);
      }, 0);
      return { ...option, votes: totalVotesForPoll };
    });

    console.log('[PollDataService] 📊 Agregación completada:', {
      países: Object.keys(aggregatedData).length,
      encuestas: polls.length,
      totalVotos: updatedPollOptions.reduce((sum, opt) => sum + opt.votes, 0)
    });

    return {
      aggregatedData,
      aggregatedColors,
      pollOptions: updatedPollOptions
    };
  }

  /**
   * Enviar voto
   */
  async submitVote(voteData: {
    pollId: number | string;
    optionId: number;
    subdivisionId?: number;
    latitude?: number;
    longitude?: number;
    locationSource?: string;
  }): Promise<boolean> {
    try {
      const response = await apiCall('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData)
      });

      if (!response.ok) {
        console.warn(`[PollDataService] ⚠️ Error ${response.status} enviando voto`);
        return false;
      }

      console.log('[PollDataService] ✅ Voto enviado exitosamente');
      return true;
    } catch (error) {
      console.error('[PollDataService] ❌ Error submitting vote:', error);
      return false;
    }
  }
}

// Singleton instance
export const pollDataService = new PollDataService();
