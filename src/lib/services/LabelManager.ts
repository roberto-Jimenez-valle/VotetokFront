/**
 * Label Manager Service
 * Maneja la generación y actualización de etiquetas del globo con LOD (Level of Detail)
 */

export interface SubdivisionLabel {
  iso: string;
  name: string;
  lat: number;
  lng: number;
  size?: number;
  color?: string;
  opacity?: number;
}

// Umbrales de altitud para LOD
export const COUNTRY_LABELS_ALT = 2.5;
export const SUBDIVISION_LABELS_ALT = 0.8;
export const DETAILED_LABELS_ALT = 0.3;

/**
 * LabelManager - Servicio para gestionar etiquetas del globo
 */
export class LabelManager {
  private currentLabels: SubdivisionLabel[] = [];
  private lastUpdateTime = 0;
  private readonly THROTTLE_DELAY = 200; // ms

  /**
   * Generar etiquetas de países
   */
  generateCountryLabels(polygons: any[]): SubdivisionLabel[] {
    const labels: SubdivisionLabel[] = [];

    for (const poly of polygons) {
      const props = poly.properties || {};
      const iso = props.ISO_A3 || props.iso_a3 || props.ADM0_A3;
      const name = props.NAME || props.name || props.ADMIN;

      if (!iso || !name) continue;

      // Calcular centroide
      const centroid = this.calculateCentroid(poly);
      if (!centroid) continue;

      labels.push({
        iso,
        name,
        lat: centroid.lat,
        lng: centroid.lng,
        size: 12,
        color: '#ffffff',
        opacity: 0.9
      });
    }

    console.log(`[LabelManager] 🏷️ ${labels.length} etiquetas de países generadas`);
    return labels;
  }

  /**
   * Generar etiquetas de subdivisiones con datos
   */
  generateSubdivisionLabels(
    polygons: any[],
    answersData: Record<string, Record<string, number>>,
    currentAltitude?: number
  ): SubdivisionLabel[] {
    const labels: SubdivisionLabel[] = [];

    // Calcular áreas para priorizar polígonos más grandes
    const polygonsWithArea = polygons.map(poly => ({
      poly,
      area: this.calculatePolygonArea(poly)
    }));

    // Ordenar por área descendente
    polygonsWithArea.sort((a, b) => b.area - a.area);

    for (const { poly, area } of polygonsWithArea) {
      const props = poly.properties || {};
      const subdivisionId = props.ID_1 || props.id_1 || props.subdivisionId;
      const name = props.NAME_1 || props.name_1 || props.NAME || props.name;

      if (!subdivisionId || !name) continue;

      // Solo mostrar etiquetas de polígonos CON DATOS
      const hasData = answersData && answersData[subdivisionId];
      if (!hasData) continue;

      const centroid = this.calculateCentroid(poly);
      if (!centroid) continue;

      // Tamaño proporcional al área (con límites)
      const size = Math.max(10, Math.min(16, 10 + Math.log(area + 1) * 2));

      labels.push({
        iso: subdivisionId,
        name,
        lat: centroid.lat,
        lng: centroid.lng,
        size,
        color: '#ffffff',
        opacity: 0.85
      });
    }

    console.log(`[LabelManager] 🏷️ ${labels.length} etiquetas de subdivisiones generadas`);
    return labels;
  }

  /**
   * Generar etiqueta única para nombre de país actual
   */
  generateCountryNameLabel(
    countryName: string,
    polygons: any[]
  ): SubdivisionLabel[] {
    if (!polygons || polygons.length === 0) return [];

    // Buscar polígono padre o el más grande
    const parentPoly = polygons.find(p => p.properties?._isParent) || polygons[0];
    const centroid = this.calculateCentroid(parentPoly);

    if (!centroid) return [];

    return [{
      iso: 'COUNTRY_NAME',
      name: countryName,
      lat: centroid.lat,
      lng: centroid.lng,
      size: 18,
      color: '#ffffff',
      opacity: 1.0
    }];
  }

  /**
   * Generar etiqueta única para nombre de subdivisión actual
   */
  generateSubdivisionNameLabel(
    subdivisionName: string,
    polygons: any[]
  ): SubdivisionLabel[] {
    if (!polygons || polygons.length === 0) return [];

    // Usar el primer polígono o el más grande
    const mainPoly = polygons.reduce((largest, current) => {
      const largestArea = this.calculatePolygonArea(largest);
      const currentArea = this.calculatePolygonArea(current);
      return currentArea > largestArea ? current : largest;
    }, polygons[0]);

    const centroid = this.calculateCentroid(mainPoly);
    if (!centroid) return [];

    return [{
      iso: 'SUBDIVISION_NAME',
      name: subdivisionName,
      lat: centroid.lat,
      lng: centroid.lng,
      size: 16,
      color: '#ffffff',
      opacity: 0.95
    }];
  }

  /**
   * Actualizar etiquetas basado en LOD
   */
  updateLabelsForAltitude(
    altitude: number,
    level: 'world' | 'country' | 'subdivision',
    options: {
      worldPolygons?: any[];
      countryPolygons?: any[];
      subdivisionPolygons?: any[];
      countryName?: string;
      subdivisionName?: string;
      answersData?: Record<string, Record<string, number>>;
    }
  ): SubdivisionLabel[] {
    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateTime < this.THROTTLE_DELAY) {
      return this.currentLabels;
    }
    this.lastUpdateTime = now;

    let newLabels: SubdivisionLabel[] = [];

    // Lógica LOD por nivel y altitud
    if (level === 'world') {
      if (altitude < COUNTRY_LABELS_ALT && options.worldPolygons) {
        newLabels = this.generateCountryLabels(options.worldPolygons);
      }
    } else if (level === 'country') {
      if (altitude >= SUBDIVISION_LABELS_ALT && options.countryName && options.countryPolygons) {
        // Solo nombre del país
        newLabels = this.generateCountryNameLabel(options.countryName, options.countryPolygons);
      } else if (altitude < SUBDIVISION_LABELS_ALT && options.countryPolygons && options.answersData) {
        // Etiquetas de subdivisiones
        const subdivisionPolygons = options.countryPolygons.filter((p: any) => !p.properties?._isParent);
        newLabels = this.generateSubdivisionLabels(subdivisionPolygons, options.answersData, altitude);
      }
    } else if (level === 'subdivision') {
      if (altitude >= SUBDIVISION_LABELS_ALT) {
        // Sin etiquetas en zoom out
        newLabels = [];
      } else if (altitude >= DETAILED_LABELS_ALT && altitude < SUBDIVISION_LABELS_ALT) {
        // Solo nombre de la subdivisión
        if (options.subdivisionName && options.subdivisionPolygons) {
          newLabels = this.generateSubdivisionNameLabel(options.subdivisionName, options.subdivisionPolygons);
        }
      } else if (altitude < DETAILED_LABELS_ALT && options.subdivisionPolygons && options.answersData) {
        // Etiquetas detalladas de sub-subdivisiones
        newLabels = this.generateSubdivisionLabels(options.subdivisionPolygons, options.answersData, altitude);
      }
    }

    this.currentLabels = newLabels;
    return newLabels;
  }

  /**
   * Calcular centroide de un polígono
   */
  private calculateCentroid(feature: any): { lat: number; lng: number } | null {
    try {
      const geometry = feature.geometry || feature;
      let coords: number[][][] = [];

      if (geometry.type === 'Polygon') {
        coords = [geometry.coordinates[0]];
      } else if (geometry.type === 'MultiPolygon') {
        coords = geometry.coordinates.map((poly: any) => poly[0]);
      } else {
        return null;
      }

      let totalLat = 0;
      let totalLng = 0;
      let pointCount = 0;

      for (const ring of coords) {
        for (const point of ring) {
          totalLng += point[0];
          totalLat += point[1];
          pointCount++;
        }
      }

      if (pointCount === 0) return null;

      return {
        lat: totalLat / pointCount,
        lng: totalLng / pointCount
      };
    } catch (error) {
      console.error('[LabelManager] Error calculating centroid:', error);
      return null;
    }
  }

  /**
   * Calcular área aproximada de un polígono
   */
  private calculatePolygonArea(feature: any): number {
    try {
      const geometry = feature.geometry || feature;
      let totalArea = 0;

      if (geometry.type === 'Polygon') {
        totalArea = this.calculateRingArea(geometry.coordinates[0]);
      } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
          totalArea += this.calculateRingArea(polygon[0]);
        }
      }

      return Math.abs(totalArea);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calcular área de un anillo de coordenadas (Shoelace formula)
   */
  private calculateRingArea(ring: number[][]): number {
    let area = 0;
    const n = ring.length;

    for (let i = 0; i < n - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      area += x1 * y2 - x2 * y1;
    }

    return area / 2;
  }

  /**
   * Obtener etiquetas actuales
   */
  getCurrentLabels(): SubdivisionLabel[] {
    return this.currentLabels;
  }

  /**
   * Limpiar etiquetas
   */
  clear(): void {
    this.currentLabels = [];
  }
}

// Singleton instance
export const labelManager = new LabelManager();
