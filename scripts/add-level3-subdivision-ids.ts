import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para agregar IDs de nivel 3 (sub-subdivisiones) a los votos existentes
 * 
 * Convierte:
 * - ESP.1 → ESP.1.1, ESP.1.2, ESP.1.3, etc. (según la ciudad)
 * 
 * Mapeo de ciudades a IDs de nivel 3 para Andalucía (ESP.1)
 */

const ANDALUCIA_CITIES = {
  'Sevilla': 'ESP.1.1',
  'Málaga': 'ESP.1.2',
  'Granada': 'ESP.1.3',
  'Córdoba': 'ESP.1.4',
  'Jaén': 'ESP.1.5',
  'Cádiz': 'ESP.1.6',
  'Huelva': 'ESP.1.7',
  'Almería': 'ESP.1.8'
};

const CATALUNA_CITIES = {
  'Barcelona': 'ESP.6.1',
  'Tarragona': 'ESP.6.2',
  'Girona': 'ESP.6.3',
  'Lleida': 'ESP.6.4'
};

const MADRID_CITIES = {
  'Madrid': 'ESP.8.1',
  'Alcalá de Henares': 'ESP.8.2',
  'Móstoles': 'ESP.8.3',
  'Getafe': 'ESP.8.4',
  'Leganés': 'ESP.8.5'
};

const VALENCIA_CITIES = {
  'Valencia': 'ESP.10.1',
  'Alicante': 'ESP.10.2',
  'Castellón': 'ESP.10.3',
  'Elche': 'ESP.10.4'
};

const PAIS_VASCO_CITIES = {
  'Bilbao': 'ESP.16.1',
  'Vitoria': 'ESP.16.2',
  'San Sebastián': 'ESP.16.3'
};

// Combinar todos los mapeos
const CITY_TO_LEVEL3_ID: Record<string, string> = {
  ...ANDALUCIA_CITIES,
  ...CATALUNA_CITIES,
  ...MADRID_CITIES,
  ...VALENCIA_CITIES,
  ...PAIS_VASCO_CITIES
};

async function addLevel3SubdivisionIds() {
  
  try {
    // Obtener todos los votos de España con subdivisión pero sin nivel 3
    const votes = await prisma.vote.findMany({
      where: {
        countryIso3: 'ESP',
        subdivisionId: { not: null },
        cityName: { not: null }
      }
    });

    
    if (votes.length === 0) {
            return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const vote of votes) {
      const currentSubdivisionId = vote.subdivisionId;
      const cityName = vote.cityName;

      // Si ya tiene ID de nivel 3 (contiene 2 puntos), saltar
      if (currentSubdivisionId && currentSubdivisionId.split('.').length === 3) {
        skippedCount++;
        continue;
      }

      // Buscar el ID de nivel 3 para esta ciudad
      let level3Id = null;

      // Buscar coincidencia exacta o parcial
      for (const [city, id] of Object.entries(CITY_TO_LEVEL3_ID)) {
        if (cityName?.includes(city) || city.includes(cityName || '')) {
          level3Id = id;
          break;
        }
      }

      // Si no se encuentra mapeo específico, generar uno basado en el nivel 1
      if (!level3Id && currentSubdivisionId) {
        // Extraer el número de subdivisión (ESP.1 → 1)
        const parts = currentSubdivisionId.split('.');
        if (parts.length === 2) {
          // Generar un ID de nivel 3 genérico basado en hash del nombre de ciudad
          const cityHash = (cityName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10 + 1;
          level3Id = `${currentSubdivisionId}.${cityHash}`;
        }
      }

      // Actualizar el voto con el ID de nivel 3
      if (level3Id) {
        await prisma.vote.update({
          where: { id: vote.id },
          data: {
            subdivisionId: level3Id
          }
        });

        updatedCount++;
              } else {
        skippedCount++;
              }
    }

        
    // Mostrar resumen por subdivisión nivel 3
        const summary = await prisma.vote.groupBy({
      by: ['subdivisionId', 'cityName'],
      where: {
        countryIso3: 'ESP',
        subdivisionId: { not: null }
      },
      _count: true
    });

    // Filtrar solo los que tienen nivel 3 (3 partes en el ID)
    const level3Summary = summary.filter(item => 
      item.subdivisionId && item.subdivisionId.split('.').length === 3
    );

    level3Summary
      .sort((a, b) => b._count - a._count)
      .slice(0, 20) // Mostrar top 20
      .forEach(item => {
              });

    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
addLevel3SubdivisionIds();
