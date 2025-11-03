/**
 * Color Manager Service
 * Centraliza todos los cálculos de colores para polígonos del globo
 */

import { pollDataService } from './PollDataService';

export interface ColorResult {
  [subdivisionId: string]: string;
}

export interface VoteData {
  [optionKey: string]: number;
}

export interface WinningOption {
  option: string;
  votes: number;
  percentage: number;
}

/**
 * ColorManager - Servicio para gestionar colores de polígonos
 */
export class ColorManager {
  /**
   * Encontrar la opción ganadora en un conjunto de votos
   */
  findWinningOption(votes: VoteData): WinningOption | null {
    if (!votes || Object.keys(votes).length === 0) {
      return null;
    }

    let maxVotes = 0;
    let winningOption = '';
    let totalVotes = 0;

    for (const [option, count] of Object.entries(votes)) {
      totalVotes += count;
      if (count > maxVotes) {
        maxVotes = count;
        winningOption = option;
      }
    }

    if (!winningOption || totalVotes === 0) {
      return null;
    }

    return {
      option: winningOption,
      votes: maxVotes,
      percentage: (maxVotes / totalVotes) * 100
    };
  }

  /**
   * Cargar colores de subdivisiones desde la base de datos (nivel 1)
   */
  async loadSubdivisionColors(
    pollId: number | string,
    countryIso: string,
    polygons: any[],
    colorMap: Record<string, string>
  ): Promise<ColorResult> {
    const byId: ColorResult = {};

    if (!pollId) {
      return byId;
    }

    try {
      // Cargar votos reales por subdivisión usando PollDataService
      const data = await pollDataService.loadVotesBySubdivisions(pollId, countryIso);

      if (!data || Object.keys(data).length === 0) {
        return byId;
      }

      // Filtrar solo nivel 1 exacto (ESP.1, ESP.2, etc.)
      const level1Votes: Record<string, VoteData> = {};

      for (const [subdivisionId, votes] of Object.entries(data)) {
        const parts = subdivisionId.split('.');
        // Solo incluir si tiene exactamente 2 partes
        if (parts.length === 2) {
          level1Votes[subdivisionId] = votes;
        }
      }

      // Para cada subdivisión nivel 1, calcular la opción ganadora
      for (const [subdivisionKey, votes] of Object.entries(level1Votes)) {
        const winner = this.findWinningOption(votes);

        if (winner && colorMap?.[winner.option]) {
          const color = colorMap[winner.option];

          // Buscar el polígono que coincida con esta subdivisión
          for (const poly of polygons) {
            const props = poly?.properties || {};
            const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
            const name1 = props.NAME_1 || props.name_1 || props.VARNAME_1 || props.varname_1;

            // Normalizar ID para comparación
            const normalizedId1 = String(id1).includes('.')
              ? id1
              : `${countryIso}.${id1}`;
            const normalizedSubKey = subdivisionKey.includes('.')
              ? subdivisionKey
              : `${countryIso}.${subdivisionKey}`;

            // Coincidir por ID_1 normalizado o por nombre
            if (normalizedId1 === normalizedSubKey || name1 === subdivisionKey) {
              byId[String(id1)] = color;
              break;
            }
          }
        }
      }

      console.log(
        `[ColorManager] ✅ ${Object.keys(byId).length} subdivisiones coloreadas para ${countryIso}`
      );
    } catch (error) {
      console.error('[ColorManager] ❌ Error loading subdivision colors:', error);
    }

    return byId;
  }

  /**
   * Cargar colores de sub-subdivisiones desde la base de datos (nivel 2)
   */
  async loadSubSubdivisionColors(
    pollId: number | string,
    countryIso: string,
    subdivisionId: string,
    polygons: any[],
    colorMap: Record<string, string>
  ): Promise<ColorResult> {
    const byId: ColorResult = {};

    if (!pollId) {
      return byId;
    }

    try {
      // Cargar votos reales por sub-subdivisión usando PollDataService
      const data = await pollDataService.loadVotesBySubSubdivisions(
        pollId,
        countryIso,
        subdivisionId
      );

      if (!data || Object.keys(data).length === 0) {
        // Fallback: usar datos del nivel superior
        return this.computeProportionalColors(polygons, colorMap);
      }

      // Filtrar solo nivel 2 exacto
      const level2Votes: Record<string, VoteData> = {};

      for (const [subSubdivisionId, votes] of Object.entries(data)) {
        const parts = subSubdivisionId.split('.');
        // Solo incluir si tiene exactamente 3 partes (ESP.1.2)
        if (parts.length === 3) {
          level2Votes[subSubdivisionId] = votes;
        }
      }

      // Para cada sub-subdivisión nivel 2, calcular la opción ganadora
      for (const [subSubKey, votes] of Object.entries(level2Votes)) {
        const winner = this.findWinningOption(votes);

        if (winner && colorMap?.[winner.option]) {
          const color = colorMap[winner.option];

          // Buscar el polígono que coincida
          for (const poly of polygons) {
            const props = poly?.properties || {};
            const id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
            const name2 = props.NAME_2 || props.name_2 || props.VARNAME_2 || props.varname_2;

            // Normalizar ID para comparación
            const normalizedId2 = String(id2).includes('.')
              ? id2
              : `${countryIso}.${subdivisionId}.${id2}`;
            const normalizedSubSubKey = subSubKey.includes('.')
              ? subSubKey
              : `${countryIso}.${subdivisionId}.${subSubKey}`;

            // Coincidir por ID_2 normalizado o por nombre
            if (normalizedId2 === normalizedSubSubKey || name2 === subSubKey) {
              byId[String(id2)] = color;
              break;
            }
          }
        }
      }

      console.log(
        `[ColorManager] ✅ ${Object.keys(byId).length} sub-subdivisiones coloreadas`
      );
    } catch (error) {
      console.error('[ColorManager] ❌ Error loading sub-subdivision colors:', error);
      // Fallback en caso de error
      return this.computeProportionalColors(polygons, colorMap);
    }

    return byId;
  }

  /**
   * Calcular colores proporcionales cuando no hay datos granulares
   * Distribuye los colores de manera proporcional según porcentajes
   */
  computeProportionalColors(
    polygons: any[],
    colorMap: Record<string, string>
  ): ColorResult {
    const byId: ColorResult = {};

    if (!polygons?.length || !colorMap || Object.keys(colorMap).length === 0) {
      return byId;
    }

    // Convertir colorMap a array de opciones
    const options = Object.keys(colorMap).filter(key => key !== 'No data');
    
    if (options.length === 0) {
      return byId;
    }

    // Asignar colores de manera round-robin
    polygons.forEach((poly, index) => {
      const props = poly?.properties || {};
      const id = props.ID_1 || props.id_1 || props.ID_2 || props.id_2 || props.GID_1 || props.gid_1 || props.GID_2 || props.gid_2;
      
      if (id) {
        const optionIndex = index % options.length;
        const optionKey = options[optionIndex];
        byId[String(id)] = colorMap[optionKey];
      }
    });

    return byId;
  }

  /**
   * Calcular colores desde votos legacy (mantener como fallback)
   */
  computeColorsFromVotes(
    countryIso: string,
    polygons: any[],
    regionVotes: any[],
    colorMap: Record<string, string>
  ): ColorResult {
    const byId: ColorResult = {};
    const pts = regionVotes?.length
      ? regionVotes.filter(p => p.iso3 === countryIso)
      : [];

    if (!pts.length) return byId;

    for (const poly of polygons) {
      const props = poly?.properties || {};
      const name = props.NAME_1 || props.name_1 || '';
      const id = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;

      const match = pts.find(p => p.region === name);
      if (match && colorMap?.[match.category]) {
        byId[String(id)] = colorMap[match.category];
      }
    }

    return byId;
  }
}

// Singleton instance
export const colorManager = new ColorManager();
